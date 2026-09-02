/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-gstar`.
 * @module @deepseek-ai/dsh-client-ui-gstar/invariant
 */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-gstar'

/** Cordis companion plugin name. */
export const name = 'client-ui-gstar-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: the package owns one effect-bound root registration;
// the shared slot ledger enforces unique ownership and disposal.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
