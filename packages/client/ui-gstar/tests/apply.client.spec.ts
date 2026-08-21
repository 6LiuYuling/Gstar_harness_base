import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-gstar/client'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-gstar'
import * as invariant from '@deepseek-ai/dsh-client-ui-gstar/invariant'
import { GstarApp } from '../src/client/GstarApp.tsx'

describe('ui-gstar client apply', () => {
  it('registers GSTAR as the only root occupant and releases it on teardown', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()

    expect(inject).toEqual(['slots'])
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(ctx.slots.entries('root')).toHaveLength(1)
    expect(ctx.slots.entries('root')[0]!.component).toBe(GstarApp)

    await fiber.dispose()
    expect(ctx.slots.entries('root')).toHaveLength(0)
    expect(ctx.slots.spec('root')).toEqual({ kind: 'single', scope: 'root' })
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
