/** GSTAR browser plugin that registers the product shell into the root slot. */
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-gstar-site/remote'
import type { GstarSiteCreateRequest } from '@deepseek-ai/dsh-gstar-site/types'
import { GstarApp, type GstarAppInjected } from './GstarApp.tsx'

/** Services required by the GSTAR browser plugin. */
export const inject = ['slots', 'remote', 'remote.gstarSites']

/**
 * Register the GSTAR product shell.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const createSite: GstarAppInjected['createSite'] = async (request: GstarSiteCreateRequest) => {
    const result = await ctx.remote.gstarSites.create(request)
    if (!result.ok) {
      throw new Error(`gstarSites.create failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const injected = (): GstarAppInjected => ({ createSite })

  ctx.effect(
    () => ctx.slots.register({ name: 'root', inject: injected }, GstarApp),
    'ui-gstar: root registration',
  )
}
