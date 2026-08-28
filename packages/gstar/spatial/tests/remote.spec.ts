import { Context } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import GstarSpatialService from '../src/index.ts'
import type {
  GstarDataSourceSnapshot, GstarSpatialLocateRequest, GstarSpatialPatchRequest,
  GstarSpatialRefreshAoisRequest, GstarSpatialSnapshot,
} from '../src/types.ts'
import * as invariant from '../src/invariant.ts'

const SPATIAL: GstarSpatialSnapshot = Object.freeze({
  workspaceId: WorkspaceId('site-1'),
  location: Object.freeze({ longitude: 113.3, latitude: 23.1 }),
  aois: Object.freeze([]),
  updatedAt: '2026-08-21T08:00:00.000Z',
})

class FixtureGstarSpatial extends GstarSpatialService {
  readonly patches: GstarSpatialPatchRequest[] = []
  readonly locations: GstarSpatialLocateRequest[] = []
  readonly refreshes: GstarSpatialRefreshAoisRequest[] = []

  override list(): Promise<readonly GstarSpatialSnapshot[]> {
    return Promise.resolve(Object.freeze([SPATIAL]))
  }

  override listSources(): Promise<readonly GstarDataSourceSnapshot[]> {
    return Promise.resolve(Object.freeze([{
      id: 'osm-overpass',
      name: 'OpenStreetMap / Overpass API',
      publisher: 'OpenStreetMap contributors',
      url: 'https://overpass-api.de/api/interpreter',
      categories: ['政'],
      accessMode: 'direct',
    }]))
  }

  override patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> {
    this.patches.push(request)
    return Promise.resolve(SPATIAL)
  }

  override locate(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot> {
    this.locations.push(request)
    return Promise.resolve(SPATIAL)
  }

  override refreshAois(request: GstarSpatialRefreshAoisRequest): Promise<GstarSpatialSnapshot> {
    this.refreshes.push(request)
    return Promise.resolve(SPATIAL)
  }
}

describe('gstar-spatial Service Definition', () => {
  it('owns the runtime codec dependency emitted by its generated Remote', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies?: Readonly<Record<string, string>> }

    expect(manifest.dependencies?.zod).toBe('^4.4.3')
  })

  it('publishes the provider and delegates both Remote adapters', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(FixtureGstarSpatial)
    await fiber.await()
    const location = SPATIAL.location
    if (location === undefined) throw new Error('fixture requires a station location')
    const request: GstarSpatialPatchRequest = { workspaceId: SPATIAL.workspaceId, location }
    const locateRequest: GstarSpatialLocateRequest = { workspaceId: SPATIAL.workspaceId, query: '广州局点' }
    const refreshRequest: GstarSpatialRefreshAoisRequest = { workspaceId: SPATIAL.workspaceId }

    await expect(ctx.gstarSpatial.remoteExportList()).resolves.toEqual([SPATIAL])
    await expect(ctx.gstarSpatial.remoteExportListSources()).resolves.toMatchObject([
      { id: 'osm-overpass', accessMode: 'direct' },
    ])
    await expect(ctx.gstarSpatial.remoteExportPatch(request)).resolves.toBe(SPATIAL)
    await expect(ctx.gstarSpatial.remoteExportLocate(locateRequest)).resolves.toBe(SPATIAL)
    await expect(ctx.gstarSpatial.remoteExportRefreshAois(refreshRequest)).resolves.toBe(SPATIAL)
    expect((ctx.gstarSpatial as FixtureGstarSpatial).patches).toEqual([request])
    expect((ctx.gstarSpatial as FixtureGstarSpatial).locations).toEqual([locateRequest])
    expect((ctx.gstarSpatial as FixtureGstarSpatial).refreshes).toEqual([refreshRequest])

    await fiber.dispose()
    expect(ctx.get('gstarSpatial')).toBeUndefined()
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-spatial', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (context: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
