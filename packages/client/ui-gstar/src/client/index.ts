/** GSTAR browser plugin that registers the product shell into the root slot. */
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-gstar-site/remote'
import { GstarApp, type GstarAppInjected } from './GstarApp.tsx'
import { GstarSiteRuntime } from './site-runtime.ts'

export { GstarSiteRuntime } from './site-runtime.ts'
export type { GstarSiteListState } from './site-runtime.ts'

/** Services required by the GSTAR browser plugin. */
export const inject = ['slots', 'remote', 'remote.gstarSites']

/**
 * Register the GSTAR product shell.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const sites = new GstarSiteRuntime(ctx.remote.gstarSites)
  void sites.load()
  const directoryFlow: HostObservable<boolean> = {
    getSnapshot: () => ctx.slots.entries('conversation.hero.workspace.directoryFlow').length > 0,
    subscribe: listener => ctx.slots.subscribe('conversation.hero.workspace.directoryFlow', listener),
  }
  const injected = (): GstarAppInjected => ({
    createSite: request => sites.create(request),
    hooks: { directoryFlow },
    sites: sites.list,
  })

  ctx.effect(
    () => ctx.slots.register({
      name: 'root',
      children: {
        'conversation.hero.workspace.directoryFlow': { kind: 'single', scope: 'root' },
        'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' },
      },
      inject: injected,
    }, GstarApp),
    'ui-gstar: root registration',
  )
}
