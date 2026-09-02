/**
 * Durable per-station GSTAR data-source selection schema.
 * @module @deepseek-ai/dsh-gstar-data-source-storage/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** Explicit enablement overrides keyed by stable source plugin identity. */
export const gstarDataSourceSelectionRecord = z.object({
  overrides: z.record(z.string().min(1), z.boolean()),
  updatedAt: z.iso.datetime(),
})

/** Persisted source selection inferred from the durable schema. */
export type GstarDataSourceSelectionRecord = z.infer<typeof gstarDataSourceSelectionRecord>

/** GSTAR source selections keyed by classified station Workspace identity. */
export const gstarDataSourceDomainSpec = defineDomain({
  name: 'gstar_data_sources',
  version: 0,
  tables: {
    stations: domainTable<WorkspaceId, GstarDataSourceSelectionRecord>(gstarDataSourceSelectionRecord),
  },
})
