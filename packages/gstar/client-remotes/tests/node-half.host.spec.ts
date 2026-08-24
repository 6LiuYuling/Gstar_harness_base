import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

describe('gstar-client-remotes Host half', () => {
  it('keeps the Host loader entry inert', () => {
    apply()
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
