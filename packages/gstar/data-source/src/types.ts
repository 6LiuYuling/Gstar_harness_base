/**
 * Browser-safe GSTAR data-source configuration vocabulary.
 * @module @deepseek-ai/dsh-gstar-data-source/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { GstarAoiCategory } from '@deepseek-ai/dsh-gstar-spatial/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** Stable identity of one dynamically registered GSTAR data-source plugin. */
export type GstarDataSourceId = Branded<'GstarDataSourceId'>

/** How a loaded source participates in one station's data pipeline. */
export type GstarDataSourceAccessMode = 'direct' | 'reference'

/** Product data kinds published or verified by one source. */
export type GstarDataSourceCapability = 'aoi' | 'entity' | 'verification'

/** One source plugin as configured for a specific GSTAR station. */
export interface GstarDataSourceSnapshot {
  /** Stable plugin contribution identity. */
  readonly id: GstarDataSourceId
  /** Human-readable dataset, library, or platform name. */
  readonly name: string
  /** Organization or project responsible for publishing the source. */
  readonly publisher: string
  /** Public documentation or platform entry point. */
  readonly url: string
  /** AOI categories supplied or verified by the source. */
  readonly categories: readonly GstarAoiCategory[]
  /** Data kinds supplied or verified by the source. */
  readonly capabilities: readonly GstarDataSourceCapability[]
  /** Direct sources can synchronize; references support human or pipeline verification. */
  readonly accessMode: GstarDataSourceAccessMode
  /** Public data or library license when declared. */
  readonly license?: string
  /** Whether this station currently admits the source into its pipeline. */
  readonly enabled: boolean
  /** Whether a newly classified station enables the source before an explicit override. */
  readonly defaultEnabled: boolean
  /** Whether the loaded plugin contributes an executable synchronization operation. */
  readonly synchronizable: boolean
}

/** Request the loaded source plugins and effective enablement for one station. */
export interface GstarDataSourceListRequest {
  /** Station whose source configuration is projected. */
  readonly workspaceId: WorkspaceId
}

/** Persist one station's explicit enablement override for a loaded source plugin. */
export interface GstarDataSourceSetEnabledRequest {
  /** Station whose pipeline configuration changes. */
  readonly workspaceId: WorkspaceId
  /** Loaded source plugin to configure. */
  readonly sourceId: GstarDataSourceId
  /** Effective enablement to persist. */
  readonly enabled: boolean
}

/** Run one enabled direct source plugin for one station. */
export interface GstarDataSourceSynchronizeRequest {
  /** Station receiving the source publication. */
  readonly workspaceId: WorkspaceId
  /** Enabled source plugin to run. */
  readonly sourceId: GstarDataSourceId
}

/** Result published after one source plugin completes successfully. */
export interface GstarDataSourceSynchronizationSnapshot {
  /** Station whose data changed or was checked. */
  readonly workspaceId: WorkspaceId
  /** Source plugin that completed. */
  readonly sourceId: GstarDataSourceId
  /** Completion instant in ISO-8601 form. */
  readonly synchronizedAt: string
  /** Human-readable publication summary supplied by the source plugin. */
  readonly message: string
}
