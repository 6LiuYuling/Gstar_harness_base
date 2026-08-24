/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-gstar-spatial-storage`.
 * @module @deepseek-ai/dsh-gstar-spatial-storage/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-spatial-storage'

/** Cordis companion plugin name. */
export const name = 'gstar-spatial-storage-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: station membership is checked at every list and patch;
// the storage-domain package owns durable read validation.
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
