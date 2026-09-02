import { describe, expect, it, vi } from 'vitest'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { apply, OSM_DATA_SOURCE_ID } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

describe('gstar-data-source-osm', () => {
  it('registers an executable default source and delegates synchronization to spatial storage', async () => {
    let provider: Parameters<typeof apply>[0]['gstarDataSources'] extends { register(value: infer P): unknown } ? P : never
    const dispose = vi.fn()
    const register = vi.fn((value) => { provider = value; return dispose })
    const refreshAois = vi.fn(async ({ workspaceId }) => ({ workspaceId, aois: [{ id: 'aoi-1' }] }))
    const returned = apply({ gstarDataSources: { register }, gstarSpatial: { refreshAois } } as never)

    expect(returned).toBe(dispose)
    expect(register).toHaveBeenCalledOnce()
    expect(provider!.descriptor).toMatchObject({
      id: OSM_DATA_SOURCE_ID,
      accessMode: 'direct',
      defaultEnabled: true,
      capabilities: ['aoi', 'entity'],
    })
    const workspaceId = WorkspaceId('site-1')
    await expect(provider!.synchronize!(workspaceId)).resolves.toBe('已从 OpenStreetMap 发布 1 个 AOI')
    expect(refreshAois).toHaveBeenCalledWith({ workspaceId })
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const dispose = await invariant.apply({ invariants: { register } } as never)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-data-source-osm', expect.any(Function))
    expect(dispose).toBeTypeOf('function')
  })
})
