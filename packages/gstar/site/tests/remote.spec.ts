import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import GstarSiteService from '../src/index.ts'
import type { GstarSiteCreateRequest, GstarSiteSnapshot } from '../src/types.ts'
import * as invariant from '../src/invariant.ts'

const SITE: GstarSiteSnapshot = Object.freeze({
  workspaceId: WorkspaceId('site-1'),
  path: '/stations/guangzhou',
  title: '广州局点',
  sessionCount: 2,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
})

class FixtureGstarSites extends GstarSiteService {
  readonly created: GstarSiteCreateRequest[] = []

  override list(): Promise<readonly GstarSiteSnapshot[]> {
    return Promise.resolve(Object.freeze([SITE]))
  }

  override create(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot> {
    this.created.push(request)
    return Promise.resolve(SITE)
  }
}

describe('gstar-site Service Definition', () => {
  it('publishes the provider and delegates both Remote adapters', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(FixtureGstarSites)
    await fiber.await()
    const request = { path: '/stations/guangzhou', title: '广州局点' }

    await expect(ctx.gstarSites.remoteExportList()).resolves.toEqual([SITE])
    await expect(ctx.gstarSites.remoteExportCreate(request)).resolves.toBe(SITE)
    expect((ctx.gstarSites as FixtureGstarSites).created).toEqual([request])

    await fiber.dispose()
    expect(ctx.get('gstarSites')).toBeUndefined()
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-site', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (context: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
