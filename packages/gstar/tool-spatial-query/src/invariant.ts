/** Package-owned invariant companion for the GSTAR spatial query tool. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-gstar-tool-spatial-query'

/** Cordis companion plugin name. */
export const name = 'gstar-tool-spatial-query-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// The execution path resolves station authority from the immutable calling
// Session cwd on every call, so no process-global ownership state exists.
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
