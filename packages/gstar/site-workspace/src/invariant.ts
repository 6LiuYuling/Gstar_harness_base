/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-gstar-site-workspace`.
 * @module @deepseek-ai/dsh-gstar-site-workspace/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-site-workspace'

/** Cordis companion plugin name. */
export const name = 'gstar-site-workspace-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: WorkspaceRegistry owns and validates the durable
 * station order; this provider publishes fresh read-only projections.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
