/** GSTAR browser plugin that registers the product shell into the root slot. */
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-gstar-site/remote'
import type {} from '@deepseek-ai/dsh-gstar-data-source/remote'
import type {} from '@deepseek-ai/dsh-gstar-spatial/remote'
import { GstarDataSourceRuntime } from './data-source-runtime.ts'
import { GstarApp, type GstarAppInjected } from './GstarApp.tsx'
import { GstarLayoutController } from './layout-service.ts'
import { GstarSiteRuntime } from './site-runtime.ts'
import { GstarSpatialRuntime } from './spatial-runtime.ts'
import { createGstarStore } from './stores.ts'

export { GstarSiteRuntime } from './site-runtime.ts'
export type { GstarSiteListState } from './site-runtime.ts'
export { GstarDataSourceRuntime } from './data-source-runtime.ts'
export type { GstarDataSourceListState } from './data-source-runtime.ts'
export { GstarSpatialRuntime } from './spatial-runtime.ts'
export type { GstarSpatialListState } from './spatial-runtime.ts'

/** Services required by the GSTAR browser plugin. */
export const inject = [
  'slots', 'sessions', 'workspaces', 'remote',
  'remote.gstarDataSources', 'remote.gstarSites', 'remote.gstarSpatial',
]

/**
 * Register the GSTAR product shell.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const sites = new GstarSiteRuntime(ctx.remote.gstarSites)
  const dataSources = new GstarDataSourceRuntime(ctx.remote.gstarDataSources)
  const spatial = new GstarSpatialRuntime(ctx.remote.gstarSpatial)
  const layout = new GstarLayoutController()
  void sites.load()
  void spatial.load()
  const directoryFlow: HostObservable<boolean> = {
    getSnapshot: () => ctx.slots.entries('conversation.hero.workspace.directoryFlow').length > 0,
    subscribe: listener => ctx.slots.subscribe('conversation.hero.workspace.directoryFlow', listener),
  }
  const injected = (): GstarAppInjected => ({
    createSite: async (request) => {
      const site = await sites.create(request)
      await spatial.load()
      return site
    },
    deleteSite: async (request) => {
      const site = await sites.delete(request)
      await spatial.load()
      return site
    },
    openSite: (workspaceId) => {
      // Never let a restored generic-Web session flash inside the GSTAR chat column.
      ctx.sessions.clear()
      ctx.workspaces.startSession(workspaceId)
      void dataSources.load({ workspaceId })
    },
    patchSpatial: request => spatial.patch(request),
    locateSpatial: request => spatial.locate(request),
    loadDataSources: workspaceId => dataSources.load({ workspaceId }),
    setDataSourceEnabled: request => dataSources.setEnabled(request),
    synchronizeDataSource: async (request) => {
      const result = await dataSources.synchronize(request)
      await spatial.load()
      return result
    },
    hooks: { directoryFlow, sites: sites.list, sources: dataSources.list, spatial: spatial.list },
  })

  ctx.effect(
    () => {
      const disposeLayout = ctx.reflect.provide('layout', layout)
      const disposeRoot = ctx.slots.register({
        name: 'root',
        children: {
          'conversation': { kind: 'single', scope: 'session-maybe' },
          'details': { kind: 'single', scope: 'session' },
          'shell.overlay': { kind: 'list', scope: 'root' },
          'conversation.hero.workspace.directoryFlow': { kind: 'single', scope: 'root' },
          'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
        },
        store: createGstarStore,
        inject: (actions) => {
          layout.attach(actions)
          return injected()
        },
      }, GstarApp)
      return () => {
        disposeRoot()
        void disposeLayout()
      }
    },
    'ui-gstar: layout service + root registration',
  )
}
