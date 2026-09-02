/**
 * Durable GSTAR station-membership sidecar over generic Workspace ids.
 * @module @deepseek-ai/dsh-gstar-site-workspace/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** One durable classification row for a Workspace explicitly connected as a GSTAR station. */
export const gstarSiteMembershipRecord = z.object({
  registeredAt: z.iso.datetime(),
})

/** Persisted station membership inferred from its durable schema. */
export type GstarSiteMembershipRecord = z.infer<typeof gstarSiteMembershipRecord>

/** GSTAR-only Workspace membership; generic Workspace records remain unchanged. */
export const gstarSiteWorkspaceDomainSpec = defineDomain({
  name: 'gstar_site_workspace',
  version: 0,
  tables: {
    sites: domainTable<WorkspaceId, GstarSiteMembershipRecord>(gstarSiteMembershipRecord),
  },
})
