import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-gstar/client'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-gstar'
import * as invariant from '@deepseek-ai/dsh-client-ui-gstar/invariant'
import { GstarApp, type GstarAppInjected } from '../src/client/GstarApp.tsx'

describe('ui-gstar client apply', () => {
  it('registers GSTAR as the only root occupant and releases it on teardown', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const site = {
      workspaceId: 'workspace-1',
      path: '/stations/guangzhou',
      title: '广州局点',
      sessionCount: 0,
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-21T08:00:00.000Z',
    }
    const create = vi.fn().mockResolvedValue({ ok: true, value: site })
    class RemoteService extends Service {
      constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
    }
    new RemoteService(ctx)
    ctx.provide('remote.gstarSites', { create })

    expect(inject).toEqual(['slots', 'remote', 'remote.gstarSites'])
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(ctx.slots.entries('root')).toHaveLength(1)
    const entry = ctx.slots.entries('root')[0]!
    expect(entry.component).toBe(GstarApp)
    const injected = (entry.inject as unknown as () => GstarAppInjected)()
    await expect(injected.createSite({ path: site.path, title: site.title })).resolves.toEqual(site)
    expect(create).toHaveBeenCalledWith({ path: site.path, title: site.title })

    await fiber.dispose()
    expect(ctx.slots.entries('root')).toHaveLength(0)
    expect(ctx.slots.spec('root')).toEqual({ kind: 'single', scope: 'root' })
  })

  it('surfaces a typed Remote failure to the root component action', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    class RemoteService extends Service {
      constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
    }
    new RemoteService(ctx)
    ctx.provide('remote.gstarSites', {
      create: () => Promise.resolve({ ok: false, error: { code: 'NOT_FOUND', message: 'directory missing' } }),
    })
    await ctx.plugin({ inject: [...inject], apply }).await()
    const entry = ctx.slots.entries('root')[0]!
    const injected = (entry.inject as unknown as () => GstarAppInjected)()

    await expect(injected.createSite({ path: '/missing' }))
      .rejects.toThrow('gstarSites.create failed: NOT_FOUND: directory missing')
  })
})

describe('ui-gstar node half and invariant companion', () => {
  it('keeps the Host loader entry inert', () => {
    nodeApply()
    expect(true).toBe(true)
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await (invariant as { apply: (ctx: never) => Promise<() => void> }).apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-client-ui-gstar', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (context: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
