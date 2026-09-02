import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import GstarDataSourceService, {
  GstarDataSourceId, type GstarDataSourceProvider,
} from '../src/index.ts'
import type {
  GstarDataSourceListRequest, GstarDataSourceSetEnabledRequest, GstarDataSourceSnapshot,
  GstarDataSourceSynchronizationSnapshot, GstarDataSourceSynchronizeRequest,
} from '../src/types.ts'
import * as invariant from '../src/invariant.ts'

const WORKSPACE_ID = WorkspaceId('site-1')
const SOURCE_ID = GstarDataSourceId('fixture-source')
const SOURCE: GstarDataSourceSnapshot = Object.freeze({
  id: SOURCE_ID,
  name: 'Fixture source',
  publisher: 'Fixture publisher',
  url: 'https://example.com/source',
  categories: ['企'] as const,
  capabilities: ['entity'] as const,
  accessMode: 'direct',
  enabled: true,
  defaultEnabled: true,
  synchronizable: true,
})

class FixtureDataSources extends GstarDataSourceService {
  readonly registrations: GstarDataSourceProvider[] = []
  readonly enabled: GstarDataSourceSetEnabledRequest[] = []
  readonly synchronized: GstarDataSourceSynchronizeRequest[] = []

  override register(provider: GstarDataSourceProvider): () => void {
    this.registrations.push(provider)
    return () => {}
  }

  override list(_request: GstarDataSourceListRequest): Promise<readonly GstarDataSourceSnapshot[]> {
    return Promise.resolve([SOURCE])
  }

  override setEnabled(request: GstarDataSourceSetEnabledRequest): Promise<GstarDataSourceSnapshot> {
    this.enabled.push(request)
    return Promise.resolve({ ...SOURCE, enabled: request.enabled })
  }

  override synchronize(
    request: GstarDataSourceSynchronizeRequest,
  ): Promise<GstarDataSourceSynchronizationSnapshot> {
    this.synchronized.push(request)
    return Promise.resolve({
      workspaceId: request.workspaceId,
      sourceId: request.sourceId,
      synchronizedAt: '2026-08-29T08:00:00.000Z',
      message: 'fixture synchronized',
    })
  }
}

describe('gstar-data-source Service Definition', () => {
  it('brands validated ids and rejects empty identities', () => {
    expect(GstarDataSourceId('source-1')).toBe('source-1')
    expect(() => GstarDataSourceId('  ')).toThrow('must be non-empty')
  })

  it('publishes the provider and delegates all Remote adapters', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(FixtureDataSources)
    await fiber.await()
    const listRequest = { workspaceId: WORKSPACE_ID }
    const enableRequest = { workspaceId: WORKSPACE_ID, sourceId: SOURCE_ID, enabled: false }
    const synchronizeRequest = { workspaceId: WORKSPACE_ID, sourceId: SOURCE_ID }

    await expect(ctx.gstarDataSources.remoteExportList(listRequest)).resolves.toEqual([SOURCE])
    await expect(ctx.gstarDataSources.remoteExportSetEnabled(enableRequest))
      .resolves.toMatchObject({ id: SOURCE_ID, enabled: false })
    await expect(ctx.gstarDataSources.remoteExportSynchronize(synchronizeRequest))
      .resolves.toMatchObject({ sourceId: SOURCE_ID, message: 'fixture synchronized' })
    expect((ctx.gstarDataSources as FixtureDataSources).enabled).toEqual([enableRequest])
    expect((ctx.gstarDataSources as FixtureDataSources).synchronized).toEqual([synchronizeRequest])

    await fiber.dispose()
    expect(ctx.get('gstarDataSources')).toBeUndefined()
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-data-source', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (context: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
