/** GSTAR-only extension of the standard DSH Client Remote assembly. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import gstarDataSourcesRemote from '@deepseek-ai/dsh-gstar-data-source/remote'
import gstarSitesRemote from '@deepseek-ai/dsh-gstar-site/remote'
import gstarSpatialRemote from '@deepseek-ai/dsh-gstar-spatial/remote'
// Pull the standard `ctx.remote` Client assembly declaration into this face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'

/** Required service: the standard typed Client Remote carrier. */
export const inject = ['remote']

/**
 * Mount only the GSTAR Host namespaces selected by the `gstar` Profile.
 * @param ctx - DSH Client context carrying the standard Remote carrier.
 * @returns disposer for the GSTAR namespace contribution.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeSites = await ctx.remote.$mount(gstarSitesRemote)
  const disposeSpatial = await ctx.remote.$mount(gstarSpatialRemote)
  const disposeDataSources = await ctx.remote.$mount(gstarDataSourcesRemote)
  return async () => {
    await disposeDataSources()
    await disposeSpatial()
    await disposeSites()
  }
}
