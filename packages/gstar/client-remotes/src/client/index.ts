/** GSTAR-only extension of the standard DSH Client Remote assembly. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import gstarSitesRemote from '@deepseek-ai/dsh-gstar-site/remote'
// Pull the standard `ctx.remote` Client assembly declaration into this face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'

/** Required service: the standard typed Client Remote carrier. */
export const inject = ['remote']

/**
 * Mount only the GSTAR Host namespaces selected by the `gstar` Profile.
 * @param ctx - DSH Client context carrying the standard Remote carrier.
 * @returns disposer for the GSTAR namespace contribution.
 */
export function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  return ctx.remote.$mount(gstarSitesRemote)
}
