import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import gstarDataSourcesRemote from '@deepseek-ai/dsh-gstar-data-source/remote'
import gstarSitesRemote from '@deepseek-ai/dsh-gstar-site/remote'
import gstarSpatialRemote from '@deepseek-ai/dsh-gstar-spatial/remote'
import { apply, inject } from '../src/client/index.ts'

describe('gstar-client-remotes', () => {
  it('mounts all generated GSTAR contributions and disposes them in reverse order', async () => {
    const calls: string[] = []
    const disposeSites = vi.fn(async () => { calls.push('dispose-sites') })
    const disposeSpatial = vi.fn(async () => { calls.push('dispose-spatial') })
    const disposeDataSources = vi.fn(async () => { calls.push('dispose-data-sources') })
    const mount = vi.fn()
      .mockResolvedValueOnce(disposeSites)
      .mockResolvedValueOnce(disposeSpatial)
      .mockResolvedValueOnce(disposeDataSources)
    const ctx = new Context()
    ctx.provide('remote', { $mount: mount } as never)

    expect(inject).toEqual(['remote'])
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(mount).toHaveBeenCalledWith(gstarSitesRemote)
    expect(mount).toHaveBeenCalledWith(gstarSpatialRemote)
    expect(mount).toHaveBeenCalledWith(gstarDataSourcesRemote)

    await fiber.dispose()
    expect(disposeSites).toHaveBeenCalledOnce()
    expect(disposeSpatial).toHaveBeenCalledOnce()
    expect(disposeDataSources).toHaveBeenCalledOnce()
    expect(calls).toEqual(['dispose-data-sources', 'dispose-spatial', 'dispose-sites'])
  })
})
