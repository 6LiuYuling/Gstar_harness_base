import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { GstarDataSourceId } from '@deepseek-ai/dsh-gstar-data-source'
import type { GstarSiteDeletionPreparation } from '@deepseek-ai/dsh-gstar-site'
import type { GstarSpatialSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import * as OsmSource from '../../data-source-osm/src/index.ts'
import * as ReferenceSource from '../../data-source-reference/src/index.ts'
import StorageGstarDataSourceService from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

const SITE_ID = WorkspaceId('site-1')
const ORDINARY_ID = WorkspaceId('workspace-1')
let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('gstar-data-source-storage through a real Loader composition', () => {
  it('composes dynamic plugins, persists station overrides, and enforces execution policy', async () => {
    const selections = new Map<WorkspaceId, { overrides: Record<string, boolean>; updatedAt: string }>()
    const put = vi.fn(async (id: WorkspaceId, value: { overrides: Record<string, boolean>; updatedAt: string }) => {
      selections.set(id, structuredClone(value))
    })
    const remove = vi.fn(async (id: WorkspaceId) => { selections.delete(id) })
    const close = vi.fn(async () => {})
    let deletionParticipant:
      | ((workspaceId: WorkspaceId) => Promise<GstarSiteDeletionPreparation>)
      | undefined
    const refreshAois = vi.fn(async ({ workspaceId }: { workspaceId: WorkspaceId }): Promise<GstarSpatialSnapshot> => ({
      workspaceId,
      aois: [],
    }))

    root = await mkdtemp(join(tmpdir(), 'dsh-gstar-data-sources-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-gstar-data-source-storage'",
      "- name: '@deepseek-ai/dsh-gstar-data-source-osm'",
      "- name: '@deepseek-ai/dsh-gstar-data-source-reference'",
      '  config:',
      "    id: 'official-enterprise'",
      "    name: '企业权威参考'",
      "    publisher: '国家机构'",
      "    url: 'https://example.gov.cn/enterprise'",
      "    categories: ['企']",
      '    defaultEnabled: false',
      '',
    ].join('\n'))

    context = new Context()
    context.provide('gstarSites', {
      list: async () => [{ workspaceId: SITE_ID }],
      registerDeletionParticipant(participant: typeof deletionParticipant) {
        deletionParticipant = participant
        return () => { deletionParticipant = undefined }
      },
    } as never)
    context.provide('gstarSpatial', { refreshAois } as never)
    context.provide('storageDomain', {
      open: vi.fn(async () => ({
        table: () => ({
          get: (id: WorkspaceId) => selections.get(id),
          put,
          delete: remove,
        }),
        close,
      })),
    } as never)
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (specifier === '@deepseek-ai/dsh-gstar-data-source-storage') return StorageGstarDataSourceService
        if (specifier === '@deepseek-ai/dsh-gstar-data-source-osm') return OsmSource
        if (specifier === '@deepseek-ai/dsh-gstar-data-source-reference') return ReferenceSource
        throw new Error(`unexpected Loader import: ${specifier}`)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    await expect(context.gstarDataSources.list({ workspaceId: SITE_ID })).resolves.toMatchObject([
      { id: 'official-enterprise', enabled: false, accessMode: 'reference', synchronizable: false },
      { id: 'osm-overpass', enabled: true, accessMode: 'direct', synchronizable: true },
    ])
    await expect(context.gstarDataSources.list({ workspaceId: ORDINARY_ID }))
      .rejects.toThrow('is not a GSTAR station')

    await expect(context.gstarDataSources.setEnabled({
      workspaceId: SITE_ID,
      sourceId: GstarDataSourceId('official-enterprise'),
      enabled: true,
    })).resolves.toMatchObject({ enabled: true })
    expect(put).toHaveBeenCalledWith(SITE_ID, expect.objectContaining({
      overrides: { 'official-enterprise': true },
      updatedAt: expect.any(String),
    }))
    await expect(context.gstarDataSources.synchronize({
      workspaceId: SITE_ID,
      sourceId: GstarDataSourceId('official-enterprise'),
    })).rejects.toThrow('reference-only')

    await expect(context.gstarDataSources.synchronize({
      workspaceId: SITE_ID,
      sourceId: OsmSource.OSM_DATA_SOURCE_ID,
    })).resolves.toMatchObject({ message: '已从 OpenStreetMap 发布 0 个 AOI' })
    expect(refreshAois).toHaveBeenCalledWith({ workspaceId: SITE_ID })

    await context.gstarDataSources.setEnabled({
      workspaceId: SITE_ID,
      sourceId: OsmSource.OSM_DATA_SOURCE_ID,
      enabled: false,
    })
    await expect(context.gstarDataSources.synchronize({
      workspaceId: SITE_ID,
      sourceId: OsmSource.OSM_DATA_SOURCE_ID,
    })).rejects.toThrow('is disabled for station')
    await expect(context.gstarDataSources.setEnabled({
      workspaceId: SITE_ID,
      sourceId: GstarDataSourceId('not-loaded'),
      enabled: true,
    })).rejects.toThrow('is not loaded')

    const participant = deletionParticipant
    if (participant === undefined) throw new Error('deletion participant was not registered')
    const preparation = await participant(SITE_ID)
    expect(remove).toHaveBeenCalledWith(SITE_ID)
    expect(selections.has(SITE_ID)).toBe(false)
    await preparation.rollback()
    expect(selections.get(SITE_ID)?.overrides).toEqual({
      'official-enterprise': true,
      'osm-overpass': false,
    })

    const service = context.gstarDataSources
    await context.fiber.dispose()
    context = undefined
    expect(close).toHaveBeenCalledOnce()
    await expect(service.setEnabled({
      workspaceId: SITE_ID,
      sourceId: OsmSource.OSM_DATA_SOURCE_ID,
      enabled: true,
    })).rejects.toThrow('is not loaded')
  })

  it('rejects invalid provider shapes', () => {
    const providers = new StorageGstarDataSourceService(new Context())
    const directId = GstarDataSourceId('direct-without-operation')
    const referenceId = GstarDataSourceId('reference-with-operation')
    const descriptor = {
      name: 'fixture', publisher: 'fixture', url: 'https://example.com', categories: ['企'] as const,
      capabilities: ['entity'] as const, defaultEnabled: false,
    }
    expect(() => providers.register({
      descriptor: { ...descriptor, id: directId, accessMode: 'direct' },
    })).toThrow('must provide synchronize')
    expect(() => providers.register({
      descriptor: { ...descriptor, id: referenceId, accessMode: 'reference' },
      synchronize: async () => 'unexpected',
    })).toThrow('cannot provide synchronize')
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-data-source-storage', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (value: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
