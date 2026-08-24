/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-gstar-cesium-assets`.
 * @module @deepseek-ai/dsh-gstar-cesium-assets/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-cesium-assets'

/** Cordis companion plugin name. */
export const name = 'gstar-cesium-assets-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: the provider owns one immutable dependency directory
// and the webserver rejects duplicate route ownership during composition.
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
