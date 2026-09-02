import { describe, expect, it, vi } from 'vitest'
import type { GstarDataSourceSnapshot } from '@deepseek-ai/dsh-gstar-data-source/types'
import { GstarDataSourceRuntime } from '../src/client/data-source-runtime.ts'

const WORKSPACE_ID = 'site-1' as never
const SOURCE: GstarDataSourceSnapshot = {
  id: 'osm-overpass' as never,
  name: 'OpenStreetMap / Overpass API',
  publisher: 'OpenStreetMap contributors',
  url: 'https://www.openstreetmap.org/',
  categories: ['政'],
  capabilities: ['aoi', 'entity'],
  accessMode: 'direct',
  license: 'ODbL-1.0',
  enabled: true,
  defaultEnabled: true,
  synchronizable: true,
}

describe('GstarDataSourceRuntime', () => {
  it('loads station selections, persists toggles, and executes direct plugins', async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, value: [SOURCE] })
    const setEnabled = vi.fn().mockResolvedValue({ ok: true, value: { ...SOURCE, enabled: false } })
    const synchronize = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        workspaceId: WORKSPACE_ID,
        sourceId: SOURCE.id,
        synchronizedAt: '2026-08-29T08:00:00.000Z',
        message: 'published',
      },
    })
    const runtime = new GstarDataSourceRuntime({ list, setEnabled, synchronize })

    await runtime.load({ workspaceId: WORKSPACE_ID })
    expect(runtime.list.getSnapshot()).toEqual({
      workspaceId: WORKSPACE_ID, items: [SOURCE], phase: 'ready',
    })
    const toggle = { workspaceId: WORKSPACE_ID, sourceId: SOURCE.id, enabled: false }
    await expect(runtime.setEnabled(toggle)).resolves.toMatchObject({ enabled: false })
    expect(setEnabled).toHaveBeenCalledWith(toggle)
    expect(list).toHaveBeenCalledTimes(2)
    await expect(runtime.synchronize({ workspaceId: WORKSPACE_ID, sourceId: SOURCE.id }))
      .resolves.toMatchObject({ message: 'published' })
  })

  it('preserves same-station items on load failure and clears them while changing stations', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: [SOURCE] })
      .mockResolvedValueOnce({ ok: false, error: { code: 'INTERNAL', message: 'unavailable' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'NOT_FOUND', message: 'other station' } })
    const runtime = new GstarDataSourceRuntime({ list } as never)
    await runtime.load({ workspaceId: WORKSPACE_ID })
    await runtime.load({ workspaceId: WORKSPACE_ID })
    expect(runtime.list.getSnapshot()).toEqual({
      workspaceId: WORKSPACE_ID,
      items: [SOURCE],
      phase: 'error',
      error: 'INTERNAL: unavailable',
    })
    await runtime.load({ workspaceId: 'site-2' as never })
    expect(runtime.list.getSnapshot()).toMatchObject({ items: [], phase: 'error' })
  })

  it('rejects typed toggle and synchronization failures', async () => {
    const setEnabled = vi.fn().mockResolvedValue({
      ok: false, error: { code: 'INVALID_ARGUMENT', message: 'source not loaded' },
    })
    const synchronize = vi.fn().mockResolvedValue({
      ok: false, error: { code: 'FAILED_PRECONDITION', message: 'source disabled' },
    })
    const runtime = new GstarDataSourceRuntime({ setEnabled, synchronize } as never)
    await expect(runtime.setEnabled({ workspaceId: WORKSPACE_ID, sourceId: SOURCE.id, enabled: false }))
      .rejects.toThrow('gstarDataSources.setEnabled failed: INVALID_ARGUMENT: source not loaded')
    await expect(runtime.synchronize({ workspaceId: WORKSPACE_ID, sourceId: SOURCE.id }))
      .rejects.toThrow('gstarDataSources.synchronize failed: FAILED_PRECONDITION: source disabled')
  })

  it('ignores a stale list response after a newer station selection', async () => {
    let resolveFirst!: (value: unknown) => void
    const first = new Promise((resolve) => { resolveFirst = resolve })
    const list = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ ok: true, value: [{ ...SOURCE, enabled: false }] })
    const runtime = new GstarDataSourceRuntime({ list } as never)

    const stale = runtime.load({ workspaceId: WORKSPACE_ID })
    await runtime.load({ workspaceId: 'site-2' as never })
    resolveFirst({ ok: true, value: [SOURCE] })
    await stale
    expect(runtime.list.getSnapshot()).toMatchObject({
      workspaceId: 'site-2', items: [{ enabled: false }], phase: 'ready',
    })
  })
})
