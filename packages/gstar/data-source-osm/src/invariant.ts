/** Package-owned invariant companion for the GSTAR OpenStreetMap source plugin. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-data-source-osm'

/** Cordis companion plugin name. */
export const name = 'gstar-data-source-osm-invariant'
/** Services required before the companion can register. */
export const inject = ['invariants', 'gstarDataSources']

/** No runtime invariant: registry ownership and disposal are pinned by the package tests. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying invariant and source services.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
