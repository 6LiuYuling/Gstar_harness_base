/**
 * Browser-safe GSTAR site request and snapshot vocabulary.
 * @module @deepseek-ai/dsh-gstar-site/types
 */

import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** One GSTAR station projected from a durable DSH Workspace. */
export interface GstarSiteSnapshot {
  /** Stable Workspace identity used by every station-owned GSTAR domain. */
  readonly workspaceId: WorkspaceId
  /** Canonical directory owned by the Workspace. */
  readonly path: string
  /** Human-readable station title. */
  readonly title: string
  /** Number of header-validated Sessions currently attached to the Workspace. */
  readonly sessionCount: number
  /** Workspace creation instant in ISO-8601 form. */
  readonly createdAt: string
  /** Instant of the most recent durable Workspace metadata mutation. */
  readonly updatedAt: string
}

/** Create or resolve a GSTAR station at an existing directory. */
export interface GstarSiteCreateRequest {
  /** Existing directory path accepted by the active Workspace provider. */
  readonly path: string
  /** User-supplied station name used for display and automatic geocoding. */
  readonly title: string
}
