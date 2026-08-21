/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-gstar-app`.
 * @module @deepseek-ai/dsh-gstar-app/invariant
 */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-app'

/** Cordis companion plugin name. */
export const name = 'gstar-app-bundle-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: the bundle owns only a static patch list; every
// mounted row owns its runtime invariants and mutable relations.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
