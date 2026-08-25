import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { GstarSiteDeletionParticipant } from '@deepseek-ai/dsh-gstar-site'
import type { GstarAoiSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId as WorkspaceIdType } from '@deepseek-ai/dsh-workspace/types'
import StorageGstarSpatialService, { type GstarSpatialRecord } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

const SITE_ID = WorkspaceId('site-1')
const ORDINARY_ID = WorkspaceId('workspace-1')
const SITE = {
  workspaceId: SITE_ID,
  path: '/stations/guangzhou',
  title: '广州局点',
  sessionCount: 0,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
}

describe('gstar-spatial-storage through a real Loader composition', () => {
  it('persists only classified station spatial data and retains omitted fields', async () => {
    const records = new Map<WorkspaceIdType, GstarSpatialRecord>()
    const put = vi.fn(async (id: WorkspaceIdType, value: GstarSpatialRecord) => { records.set(id, value) })
    const remove = vi.fn(async (id: WorkspaceIdType) => { records.delete(id) })
    const close = vi.fn(async () => {})
    let deletionParticipant: ((workspaceId: WorkspaceIdType) => Promise<{
      commit(): void
      rollback(): Promise<void>
    } | void>) | undefined
    const removeParticipant = vi.fn()

    root = await mkdtemp(join(tmpdir(), 'dsh-gstar-spatial-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, "- name: '@deepseek-ai/dsh-gstar-spatial-storage'\n")

    context = new Context()
    context.provide('gstarSites', {
      list: async () => [SITE],
      registerDeletionParticipant: vi.fn((participant: GstarSiteDeletionParticipant) => {
        deletionParticipant = participant
        return removeParticipant
      }),
    } as never)
    context.provide('storageDomain', {
      open: vi.fn(async () => ({
        table: () => ({ get: (id: WorkspaceIdType) => records.get(id), put, delete: remove }),
        close,
      })),
    } as never)
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        url: 'https://nominatim.openstreetmap.org/search', statusCode: 200,
        body: {
          kind: 'text',
          content: JSON.stringify([{
            lat: '23.1291',
            lon: '113.2644',
            boundingbox: ['22.9', '23.4', '112.9', '113.8'],
            geojson: {
              type: 'Polygon',
              coordinates: [[
                [113, 23], [114, 23], [114, 24], [113, 23],
              ]],
            },
          }]),
        },
        truncated: false,
      })
    context.provide('web', { fetch } as never)
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (specifier === '@deepseek-ai/dsh-gstar-spatial-storage') return StorageGstarSpatialService
        throw new Error(`unexpected Loader import: ${specifier}`)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    await expect(context.gstarSpatial.list()).resolves.toEqual([{ workspaceId: SITE_ID, aois: [] }])
    await expect(context.gstarSpatial.patch({
      workspaceId: SITE_ID,
      location: { longitude: 113.3, latitude: 23.1 },
    })).resolves.toMatchObject({
      workspaceId: SITE_ID,
      location: { longitude: 113.3, latitude: 23.1 },
      aois: [],
    })

    const aoi: GstarAoiSnapshot = {
      id: 'aoi-1',
      name: '广州道路',
      category: '道路',
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          { longitude: 113, latitude: 23 },
          { longitude: 114, latitude: 23 },
          { longitude: 114, latitude: 24 },
          { longitude: 113, latitude: 23 },
        ]],
      },
      entities: [],
      provenance: [],
      updatedAt: '2026-08-21T08:00:00.000Z',
    }
    await expect(context.gstarSpatial.patch({ workspaceId: SITE_ID, aois: [aoi] }))
      .resolves.toMatchObject({
        workspaceId: SITE_ID,
        location: { longitude: 113.3, latitude: 23.1 },
        aois: [aoi],
      })
    expect(put).toHaveBeenCalledTimes(2)

    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州局点' }))
      .resolves.toMatchObject({
        workspaceId: SITE_ID,
        location: { longitude: 113.2644, latitude: 23.1291 },
        boundary: {
          type: 'Polygon',
          coordinates: [[
            { longitude: 113, latitude: 23 },
            { longitude: 114, latitude: 23 },
            { longitude: 114, latitude: 24 },
            { longitude: 113, latitude: 23 },
          ]],
        },
        aois: [aoi],
      })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(new URL(fetch.mock.calls[0]![0].url).searchParams.get('q')).toBe('广州')
    expect(new URL(fetch.mock.calls[0]![0].url).searchParams.get('polygon_geojson')).toBe('1')
    expect(put).toHaveBeenCalledTimes(3)

    fetch
      .mockRejectedValueOnce(new Error('web fetch failed', { cause: new Error('ECONNRESET') }))
      .mockResolvedValueOnce({
        url: 'https://photon.komoot.io/api/', statusCode: 200,
        body: {
          kind: 'text',
          content: '{"features":[{"geometry":{"type":"Point","coordinates":[113.2644,23.1291]}}]}',
        },
        truncated: false,
      })
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州局点' }))
      .resolves.not.toHaveProperty('boundary')
    expect(new URL(fetch.mock.calls[2]![0].url).hostname).toBe('photon.komoot.io')
    expect(put).toHaveBeenCalledTimes(4)

    fetch.mockRejectedValue(new Error('web fetch failed', { cause: new Error('ECONNRESET') }))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州局点' }))
      .rejects.toThrow(/Nominatim.*Photon.*ECONNRESET/u)
    expect(put).toHaveBeenCalledTimes(4)

    await expect(context.gstarSpatial.patch({ workspaceId: ORDINARY_ID, location: { longitude: 0, latitude: 0 } }))
      .rejects.toThrow('is not a GSTAR station')
    await expect(context.gstarSpatial.patch({ workspaceId: SITE_ID }))
      .rejects.toThrow('requires location, boundary, or aois')

    expect(deletionParticipant).toBeTypeOf('function')
    const preparation = await deletionParticipant!(SITE_ID)
    expect(remove).toHaveBeenCalledWith(SITE_ID)
    expect(records.has(SITE_ID)).toBe(false)
    expect(preparation).toBeTypeOf('object')
    await preparation!.rollback()
    expect(records.has(SITE_ID)).toBe(true)

    const service = context.gstarSpatial
    await context.fiber.dispose()
    context = undefined
    expect(close).toHaveBeenCalledOnce()
    expect(removeParticipant).toHaveBeenCalledOnce()
    await expect(service.patch({ workspaceId: SITE_ID, location: { longitude: 1, latitude: 1 } }))
      .rejects.toThrow('GSTAR spatial storage is disposing')
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-spatial-storage', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (value: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
