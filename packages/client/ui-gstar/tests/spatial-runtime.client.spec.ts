import { describe, expect, it, vi } from 'vitest'
import type { GstarSpatialSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { GstarSpatialRuntime } from '../src/client/spatial-runtime.ts'

const LOCATION = { longitude: 113.3, latitude: 23.1 }

const SPATIAL: GstarSpatialSnapshot = {
  workspaceId: 'site-1' as never,
  location: LOCATION,
  aois: [],
  updatedAt: '2026-08-21T08:00:00.000Z',
}

describe('GstarSpatialRuntime', () => {
  it('loads the Host projection and refreshes it after a patch', async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, value: [SPATIAL] })
    const patch = vi.fn().mockResolvedValue({ ok: true, value: SPATIAL })
    const locate = vi.fn().mockResolvedValue({ ok: true, value: SPATIAL })
    const runtime = new GstarSpatialRuntime({ list, patch, locate } as never)

    await runtime.load()
    expect(runtime.list.getSnapshot()).toEqual({ items: [SPATIAL], phase: 'ready' })
    const request = { workspaceId: SPATIAL.workspaceId, location: LOCATION }
    await expect(runtime.patch(request)).resolves.toBe(SPATIAL)
    expect(patch).toHaveBeenCalledWith(request)
    const locateRequest = { workspaceId: SPATIAL.workspaceId, query: '广州局点' }
    await expect(runtime.locate(locateRequest)).resolves.toBe(SPATIAL)
    expect(locate).toHaveBeenCalledWith(locateRequest)
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('preserves successful items when a refresh fails and rejects a failed patch', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: [SPATIAL] })
      .mockResolvedValueOnce({ ok: false, error: { code: 'INTERNAL', message: 'unavailable' } })
    const patch = vi.fn().mockResolvedValue({
      ok: false, error: { code: 'INVALID_ARGUMENT', message: 'invalid coordinate' },
    })
    const locate = vi.fn().mockResolvedValue({
      ok: false, error: { code: 'NOT_FOUND', message: 'station name not found' },
    })
    const runtime = new GstarSpatialRuntime({ list, patch, locate } as never)

    await runtime.load()
    await runtime.load()
    expect(runtime.list.getSnapshot()).toEqual({
      items: [SPATIAL], phase: 'error', error: 'INTERNAL: unavailable',
    })
    await expect(runtime.patch({ workspaceId: SPATIAL.workspaceId, location: LOCATION }))
      .rejects.toThrow('gstarSpatial.patch failed: INVALID_ARGUMENT: invalid coordinate')
    await expect(runtime.locate({ workspaceId: SPATIAL.workspaceId, query: '未知局点' }))
      .rejects.toThrow('gstarSpatial.locate failed: NOT_FOUND: station name not found')
  })

  it('ignores a stale list response after a newer refresh', async () => {
    let resolveFirst!: (value: unknown) => void
    const first = new Promise(resolve => { resolveFirst = resolve })
    const newer = { ...SPATIAL, workspaceId: 'site-2' as never }
    const list = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ ok: true, value: [newer] })
    const runtime = new GstarSpatialRuntime({ list, patch: vi.fn() } as never)

    const stale = runtime.load()
    await runtime.load()
    resolveFirst({ ok: true, value: [SPATIAL] })
    await stale
    expect(runtime.list.getSnapshot()).toEqual({ items: [newer], phase: 'ready' })
  })
})
