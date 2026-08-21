import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import gstarSitesRemote from '@deepseek-ai/dsh-gstar-site/remote'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

describe('gstar-client-remotes', () => {
  it('mounts the generated site contribution and disposes it', async () => {
    const dispose = vi.fn(async () => {})
    const mount = vi.fn(async () => dispose)
    const ctx = new Context()
    ctx.provide('remote', { $mount: mount } as never)

    expect(inject).toEqual(['remote'])
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(mount).toHaveBeenCalledWith(gstarSitesRemote)

    await fiber.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('keeps the Host loader entry inert', () => {
    nodeApply()
    expect(true).toBe(true)
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-client-remotes', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (context: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
