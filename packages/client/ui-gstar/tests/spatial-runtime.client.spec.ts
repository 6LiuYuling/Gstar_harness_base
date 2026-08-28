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
    const refreshAois = vi.fn().mockResolvedValue({ ok: true, value: SPATIAL })
    const listSources = vi.fn().mockResolvedValue({
      ok: true,
      value: [{
        id: 'osm-overpass', name: 'OpenStreetMap / Overpass API', publisher: 'OpenStreetMap contributors',
        url: 'https://overpass-api.de/api/interpreter', categories: ['政'], accessMode: 'direct',
      }],
    })
    const runtime = new GstarSpatialRuntime({ list, listSources, patch, locate, refreshAois })

    await runtime.load()
    await runtime.loadSources()
    expect(runtime.list.getSnapshot()).toEqual({ items: [SPATIAL], phase: 'ready' })
    expect(runtime.sources.getSnapshot()).toMatchObject({
      items: [{ id: 'osm-overpass', accessMode: 'direct' }], phase: 'ready',
    })
    const request = { workspaceId: SPATIAL.workspaceId, location: LOCATION }
    await expect(runtime.patch(request)).resolves.toBe(SPATIAL)
    expect(patch).toHaveBeenCalledWith(request)
    const locateRequest = { workspaceId: SPATIAL.workspaceId, query: '广州局点' }
    await expect(runtime.locate(locateRequest)).resolves.toBe(SPATIAL)
    expect(locate).toHaveBeenCalledWith(locateRequest)
    const refreshRequest = { workspaceId: SPATIAL.workspaceId }
    await expect(runtime.refreshAois(refreshRequest)).resolves.toBe(SPATIAL)
    expect(refreshAois).toHaveBeenCalledWith(refreshRequest)
    expect(list).toHaveBeenCalledTimes(4)
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
    const listSources = vi.fn().mockResolvedValue({
      ok: false, error: { code: 'INTERNAL', message: 'source catalog unavailable' },
    })
    const refreshAois = vi.fn().mockResolvedValue({
      ok: false, error: { code: 'INTERNAL', message: 'Overpass unavailable' },
    })
    const runtime = new GstarSpatialRuntime({ list, listSources, patch, locate, refreshAois })

    await runtime.load()
    await runtime.load()
    await runtime.loadSources()
    expect(runtime.list.getSnapshot()).toEqual({
      items: [SPATIAL], phase: 'error', error: 'INTERNAL: unavailable',
    })
    await expect(runtime.patch({ workspaceId: SPATIAL.workspaceId, location: LOCATION }))
      .rejects.toThrow('gstarSpatial.patch failed: INVALID_ARGUMENT: invalid coordinate')
    await expect(runtime.locate({ workspaceId: SPATIAL.workspaceId, query: '未知局点' }))
      .rejects.toThrow('gstarSpatial.locate failed: NOT_FOUND: station name not found')
    expect(runtime.sources.getSnapshot()).toEqual({
      items: [], phase: 'error', error: 'INTERNAL: source catalog unavailable',
    })
    await expect(runtime.refreshAois({ workspaceId: SPATIAL.workspaceId }))
      .rejects.toThrow('gstarSpatial.refreshAois failed: INTERNAL: Overpass unavailable')
  })

  it('ignores a stale list response after a newer refresh', async () => {
    let resolveFirst!: (value: unknown) => void
    const first = new Promise((resolve) => { resolveFirst = resolve })
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

  it('ignores a stale source-catalog response after a newer refresh', async () => {
    let resolveFirst!: (value: unknown) => void
    const first = new Promise((resolve) => { resolveFirst = resolve })
    const newer = [{
      id: 'official', name: 'Official', publisher: 'Publisher', url: 'https://example.test/',
      categories: ['政'] as const, accessMode: 'reference' as const,
    }]
    const listSources = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ ok: true, value: newer })
    const runtime = new GstarSpatialRuntime({ listSources } as never)

    const stale = runtime.loadSources()
    await runtime.loadSources()
    resolveFirst({ ok: true, value: [] })
    await stale
    expect(runtime.sources.getSnapshot()).toEqual({ items: newer, phase: 'ready' })
  })
})
