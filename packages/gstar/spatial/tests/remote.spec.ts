import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import GstarSpatialService from '../src/index.ts'
import type { GstarSpatialPatchRequest, GstarSpatialSnapshot } from '../src/types.ts'
import * as invariant from '../src/invariant.ts'

const SPATIAL: GstarSpatialSnapshot = Object.freeze({
  workspaceId: WorkspaceId('site-1'),
  location: Object.freeze({ longitude: 113.3, latitude: 23.1 }),
  aois: Object.freeze([]),
  updatedAt: '2026-08-21T08:00:00.000Z',
})

class FixtureGstarSpatial extends GstarSpatialService {
  readonly patches: GstarSpatialPatchRequest[] = []

  override list(): Promise<readonly GstarSpatialSnapshot[]> {
    return Promise.resolve(Object.freeze([SPATIAL]))
  }

  override patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> {
    this.patches.push(request)
    return Promise.resolve(SPATIAL)
  }
}

describe('gstar-spatial Service Definition', () => {
  it('publishes the provider and delegates both Remote adapters', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(FixtureGstarSpatial)
    await fiber.await()
    const location = SPATIAL.location
    if (location === undefined) throw new Error('fixture requires a station location')
    const request: GstarSpatialPatchRequest = { workspaceId: SPATIAL.workspaceId, location }

    await expect(ctx.gstarSpatial.remoteExportList()).resolves.toEqual([SPATIAL])
    await expect(ctx.gstarSpatial.remoteExportPatch(request)).resolves.toBe(SPATIAL)
    expect((ctx.gstarSpatial as FixtureGstarSpatial).patches).toEqual([request])

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
