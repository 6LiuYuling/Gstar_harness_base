import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-gstar/client'
import { apply as nodeApply } from '@deepseek-ai/dsh-client-ui-gstar'
import * as invariant from '@deepseek-ai/dsh-client-ui-gstar/invariant'
import { GstarApp, type GstarAppInjected } from '../src/client/GstarApp.tsx'

const SITE = {
  workspaceId: 'workspace-1',
  path: '/stations/guangzhou',
  title: '广州局点',
  sessionCount: 0,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
}

const ACTIONS = {
  selectSite: vi.fn(), clearSelection: vi.fn(), selectAoi: vi.fn(), closeAoi: vi.fn(), beginLocating: vi.fn(),
  finishLocating: vi.fn(), toggleSidebar: vi.fn(), openDetails: vi.fn(), closeDetails: vi.fn(),
}

async function setup(options: { readonly siteList?: unknown; readonly spatialList?: unknown } = {}) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  const startSession = vi.fn()
  const clearSession = vi.fn()
  ctx.provide('sessions', { clear: clearSession } as never)
  ctx.provide('workspaces', { startSession } as never)
  const listSites = vi.fn().mockResolvedValue(options.siteList ?? { ok: true, value: [SITE] })
  const createSite = vi.fn().mockResolvedValue({ ok: true, value: SITE })
  const deleteSite = vi.fn().mockResolvedValue({ ok: true, value: SITE })
  const listSpatial = vi.fn().mockResolvedValue(options.spatialList ?? {
    ok: true, value: [{ workspaceId: SITE.workspaceId, aois: [] }],
  })
  const patchSpatial = vi.fn().mockResolvedValue({
    ok: true, value: { workspaceId: SITE.workspaceId, aois: [], location: { longitude: 113, latitude: 23 } },
  })
  const locateSpatial = vi.fn().mockResolvedValue({
    ok: true, value: { workspaceId: SITE.workspaceId, aois: [], location: { longitude: 113, latitude: 23 } },
  })
  const listSources = vi.fn().mockResolvedValue({
    ok: true,
    value: [{
      id: 'osm-overpass', name: 'OpenStreetMap / Overpass API', publisher: 'OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/', categories: ['政'], capabilities: ['aoi', 'entity'],
      accessMode: 'direct', enabled: true, defaultEnabled: true, synchronizable: true,
    }],
  })
  const setSourceEnabled = vi.fn().mockResolvedValue({
    ok: true,
    value: {
      id: 'osm-overpass', name: 'OpenStreetMap / Overpass API', publisher: 'OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/', categories: ['政'], capabilities: ['aoi', 'entity'],
      accessMode: 'direct', enabled: false, defaultEnabled: true, synchronizable: true,
    },
  })
  const synchronizeSource = vi.fn().mockResolvedValue({
    ok: true,
    value: {
      workspaceId: SITE.workspaceId,
      sourceId: 'osm-overpass',
      synchronizedAt: '2026-08-29T08:00:00.000Z',
      message: 'OSM synchronized',
    },
  })
  ctx.provide('remote.gstarSites', { list: listSites, create: createSite, delete: deleteSite })
  ctx.provide('remote.gstarSpatial', {
    list: listSpatial, patch: patchSpatial, locate: locateSpatial,
  })
  ctx.provide('remote.gstarDataSources', {
    list: listSources, setEnabled: setSourceEnabled, synchronize: synchronizeSource,
  })
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const entry = ctx.slots.entries('root')[0]!
  const injected = (entry.inject as unknown as (actions: typeof ACTIONS) => GstarAppInjected)(ACTIONS)
  return {
    ctx, fiber, entry, injected, startSession, clearSession, listSites, createSite, deleteSite,
    listSpatial, listSources, setSourceEnabled, synchronizeSource, patchSpatial, locateSpatial,
  }
}

describe('ui-gstar client apply', () => {
  it('owns the DSH root, declares the conversation tree, and exposes only Host station projections', async () => {
    const subject = await setup()

    expect(inject).toEqual([
      'slots', 'sessions', 'workspaces', 'remote',
      'remote.gstarDataSources', 'remote.gstarSites', 'remote.gstarSpatial',
    ])
    expect(subject.entry.component).toBe(GstarApp)
    expect(subject.ctx.slots.spec('conversation')).toEqual({ kind: 'single', scope: 'session-maybe' })
    expect(subject.ctx.slots.spec('details')).toEqual({ kind: 'single', scope: 'session' })
    expect(subject.ctx.slots.spec('shell.overlay')).toEqual({ kind: 'list', scope: 'root' })
    expect(subject.ctx.slots.spec('conversation.hero.workspace.directoryFlow'))
      .toEqual({ kind: 'single', scope: 'root' })

    await vi.waitFor(() => {
      expect(subject.injected.hooks.sites.getSnapshot()).toEqual({ items: [SITE], phase: 'ready' })
      expect(subject.injected.hooks.spatial.getSnapshot()).toEqual({
        items: [{ workspaceId: SITE.workspaceId, aois: [] }], phase: 'ready',
      })
    })
    subject.injected.openSite(SITE.workspaceId as never)
    expect(subject.clearSession).toHaveBeenCalledOnce()
    expect(subject.startSession).toHaveBeenCalledWith(SITE.workspaceId)
    await vi.waitFor(() => {
      expect(subject.injected.hooks.sources.getSnapshot()).toMatchObject({
        workspaceId: SITE.workspaceId,
        items: [{ id: 'osm-overpass', accessMode: 'direct' }],
        phase: 'ready',
      })
    })

    await subject.fiber.dispose()
    expect(subject.ctx.slots.entries('root')).toHaveLength(0)
  })

  it('uses the composed DSH directory-flow hole for station creation', async () => {
    const subject = await setup()
    expect(subject.injected.hooks.directoryFlow.getSnapshot()).toBe(false)
    const listener = vi.fn()
    const unsubscribe = subject.injected.hooks.directoryFlow.subscribe(listener)
    const disposeFlow = subject.ctx.slots.register(
      { name: 'conversation.hero.workspace.directoryFlow' },
      () => null,
    )
    expect(subject.injected.hooks.directoryFlow.getSnapshot()).toBe(true)
    await vi.waitFor(() => { expect(listener).toHaveBeenCalled() })

    await expect(subject.injected.createSite({ path: SITE.path, title: SITE.title })).resolves.toEqual(SITE)
    expect(subject.createSite).toHaveBeenCalledWith({ path: SITE.path, title: SITE.title })
    expect(subject.listSites).toHaveBeenCalledTimes(2)
    expect(subject.listSpatial).toHaveBeenCalledTimes(2)
    disposeFlow()
    unsubscribe()
  })

  it('deletes station membership through the Host and refreshes both projections', async () => {
    const subject = await setup()
    await expect(subject.injected.deleteSite({ workspaceId: SITE.workspaceId as never })).resolves.toEqual(SITE)
    expect(subject.deleteSite).toHaveBeenCalledWith({ workspaceId: SITE.workspaceId })
    expect(subject.listSites).toHaveBeenCalledTimes(2)
    expect(subject.listSpatial).toHaveBeenCalledTimes(2)
  })

  it('persists location through the spatial Remote and refreshes the projection', async () => {
    const subject = await setup()
    const request = {
      workspaceId: SITE.workspaceId as never,
      location: { longitude: 113, latitude: 23 },
    }
    await expect(subject.injected.patchSpatial(request)).resolves.toMatchObject(request)
    expect(subject.patchSpatial).toHaveBeenCalledWith(request)
    expect(subject.listSpatial).toHaveBeenCalledTimes(2)

    const locateRequest = { workspaceId: SITE.workspaceId as never, query: SITE.title }
    await expect(subject.injected.locateSpatial(locateRequest)).resolves.toMatchObject({
      workspaceId: SITE.workspaceId, location: { longitude: 113, latitude: 23 },
    })
    expect(subject.locateSpatial).toHaveBeenCalledWith(locateRequest)
    expect(subject.listSpatial).toHaveBeenCalledTimes(3)

    await subject.injected.loadDataSources(SITE.workspaceId as never)
    const toggleRequest = {
      workspaceId: SITE.workspaceId as never, sourceId: 'osm-overpass' as never, enabled: false,
    }
    await expect(subject.injected.setDataSourceEnabled(toggleRequest)).resolves.toMatchObject({ enabled: false })
    expect(subject.setSourceEnabled).toHaveBeenCalledWith(toggleRequest)
    const synchronizeRequest = {
      workspaceId: SITE.workspaceId as never, sourceId: 'osm-overpass' as never,
    }
    await expect(subject.injected.synchronizeDataSource(synchronizeRequest))
      .resolves.toMatchObject({ message: 'OSM synchronized' })
    expect(subject.synchronizeSource).toHaveBeenCalledWith(synchronizeRequest)
    expect(subject.listSpatial).toHaveBeenCalledTimes(4)
  })

  it('surfaces typed station and spatial Remote failures independently', async () => {
    const subject = await setup({
      siteList: { ok: false, error: { code: 'INTERNAL', message: 'membership unavailable' } },
      spatialList: { ok: false, error: { code: 'INTERNAL', message: 'spatial unavailable' } },
    })
    await vi.waitFor(() => {
      expect(subject.injected.hooks.sites.getSnapshot().phase).toBe('error')
      expect(subject.injected.hooks.spatial.getSnapshot().phase).toBe('error')
    })
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
