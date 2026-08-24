import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import gstarSitesRemote from '@deepseek-ai/dsh-gstar-site/remote'
import { apply, inject } from '../src/client/index.ts'

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
})
