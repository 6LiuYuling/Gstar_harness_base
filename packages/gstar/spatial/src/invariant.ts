/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-gstar-spatial`.
 * @module @deepseek-ai/dsh-gstar-spatial/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-spatial'

/** Cordis companion plugin name. */
export const name = 'gstar-spatial-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: the Service Definition retains no spatial state;
// providers own persistence and station-membership validation.
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
