/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-gstar-data-source-storage`.
 * @module @deepseek-ai/dsh-gstar-data-source-storage/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-data-source-storage'

/** Cordis companion plugin name. */
export const name = 'gstar-data-source-storage-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/** No runtime invariant: the durable table and registry lifecycle are exercised by the Loader composition suite. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying invariant and GSTAR source services.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
