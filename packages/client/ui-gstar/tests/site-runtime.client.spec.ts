import { describe, expect, it, vi } from 'vitest'
import type { GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import { GstarSiteRuntime } from '../src/client/site-runtime.ts'

const SITE: GstarSiteSnapshot = {
  workspaceId: 'site-1' as never,
  path: '/stations/guangzhou',
  title: '广州局点',
  sessionCount: 0,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
}

describe('GstarSiteRuntime', () => {
  it('loads Host membership and refreshes it after station creation', async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, value: [SITE] })
    const create = vi.fn().mockResolvedValue({ ok: true, value: SITE })
    const remove = vi.fn().mockResolvedValue({ ok: true, value: SITE })
    const runtime = new GstarSiteRuntime({ list, create, delete: remove } as never)

    await runtime.load()
    expect(runtime.list.getSnapshot()).toEqual({ items: [SITE], phase: 'ready' })
    await expect(runtime.create({ path: SITE.path, title: SITE.title })).resolves.toBe(SITE)
    expect(create).toHaveBeenCalledWith({ path: SITE.path, title: SITE.title })
    expect(list).toHaveBeenCalledTimes(2)
    await expect(runtime.delete({ workspaceId: SITE.workspaceId })).resolves.toBe(SITE)
    expect(remove).toHaveBeenCalledWith({ workspaceId: SITE.workspaceId })
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('publishes Remote failures and preserves the last successful items', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: [SITE] })
      .mockResolvedValueOnce({ ok: false, error: { code: 'INTERNAL', message: 'unavailable' } })
    const create = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'directory missing' },
    })
    const remove = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL', message: 'delete failed' },
    })
    const runtime = new GstarSiteRuntime({ list, create, delete: remove } as never)

    await runtime.load()
    await runtime.load()
    expect(runtime.list.getSnapshot()).toEqual({
      items: [SITE],
      phase: 'error',
      error: 'INTERNAL: unavailable',
    })
    await expect(runtime.create({ path: '/missing', title: '缺失局点' }))
      .rejects.toThrow('gstarSites.create failed: NOT_FOUND: directory missing')
    await expect(runtime.delete({ workspaceId: SITE.workspaceId }))
      .rejects.toThrow('gstarSites.delete failed: INTERNAL: delete failed')
  })

  it('ignores a stale list response that resolves after a newer refresh', async () => {
    let resolveFirst!: (value: unknown) => void
    const first = new Promise(resolve => { resolveFirst = resolve })
    const newer = { ...SITE, workspaceId: 'site-2' as never, title: '深圳局点' }
    const list = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ ok: true, value: [newer] })
    const runtime = new GstarSiteRuntime({ list, create: vi.fn() } as never)

    const staleLoad = runtime.load()
    await runtime.load()
    resolveFirst({ ok: true, value: [SITE] })
    await staleLoad

    expect(runtime.list.getSnapshot()).toEqual({ items: [newer], phase: 'ready' })
  })
})
