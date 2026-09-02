/**
 * Provider-neutral registry and station configuration for GSTAR data-source plugins.
 * @module @deepseek-ai/dsh-gstar-data-source
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { GstarAoiCategory } from '@deepseek-ai/dsh-gstar-spatial/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {
  GstarDataSourceAccessMode, GstarDataSourceCapability, GstarDataSourceId as GstarDataSourceIdBrand,
  GstarDataSourceListRequest, GstarDataSourceSetEnabledRequest, GstarDataSourceSnapshot,
  GstarDataSourceSynchronizationSnapshot, GstarDataSourceSynchronizeRequest,
} from './types.ts'

export type {
  GstarDataSourceAccessMode, GstarDataSourceCapability,
  GstarDataSourceListRequest, GstarDataSourceSetEnabledRequest, GstarDataSourceSnapshot,
  GstarDataSourceSynchronizationSnapshot, GstarDataSourceSynchronizeRequest,
} from './types.ts'

/** Stable identity of one dynamically registered GSTAR data-source plugin. */
export type GstarDataSourceId = GstarDataSourceIdBrand

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Loaded data-source plugins and station-specific enablement. */
    gstarDataSources: GstarDataSourceService
  }
}

/** Immutable metadata registered by one source plugin. */
export interface GstarDataSourceDescriptor {
  /** Stable identity unique within the live GSTAR source registry. */
  readonly id: GstarDataSourceId
  /** Human-readable dataset, library, or platform name. */
  readonly name: string
  /** Organization or project responsible for publishing the source. */
  readonly publisher: string
  /** Public documentation or platform entry point. */
  readonly url: string
  /** AOI categories supplied or verified by the source. */
  readonly categories: readonly GstarAoiCategory[]
  /** Product data kinds supplied or verified by the source. */
  readonly capabilities: readonly GstarDataSourceCapability[]
  /** Direct sources execute acquisition; references document validation inputs. */
  readonly accessMode: GstarDataSourceAccessMode
  /** Public data or library license when declared. */
  readonly license?: string
  /** Effective enablement before a station stores an explicit override. */
  readonly defaultEnabled: boolean
}

/** Executable contribution owned by one dynamically loaded source plugin. */
export interface GstarDataSourceProvider {
  /** Source metadata projected to Host and Client consumers. */
  readonly descriptor: GstarDataSourceDescriptor
  /**
   * Synchronize this source into one station; omitted for reference-only plugins.
   * @param workspaceId - Classified station receiving the source publication.
   * @returns a concise publication summary after the source commits its data.
   */
  synchronize?(workspaceId: WorkspaceId): Promise<string>
}

/**
 * Convert a parsed non-empty source key into its opaque product identity.
 * @param value - Validated non-empty source key.
 * @returns the opaque source identity used across Host and Client boundaries.
 */
export function GstarDataSourceId(value: string): GstarDataSourceId {
  if (value.trim().length === 0) throw new Error('GSTAR data-source id must be non-empty')
  return value as GstarDataSourceId
}

/** Provider-neutral source registry, durable selection, and Host Remote adapter. */
export abstract class GstarDataSourceService extends TypertRemoteService {
  /**
   * @param ctx - Host context receiving the `gstarDataSources` service.
   */
  constructor(ctx: Context) {
    super(ctx, 'gstarDataSources')
  }

  /**
   * Register one source plugin until its Cordis effect is disposed.
   * @param provider - Source metadata and optional synchronization operation.
   * @returns disposer that removes the exact live contribution.
   */
  abstract register(provider: GstarDataSourceProvider): () => void

  /**
   * List loaded source plugins with effective enablement for one station.
   * @param request - Classified station whose configuration is projected.
   * @returns immutable source snapshots ordered by stable source id.
   */
  abstract list(request: GstarDataSourceListRequest): Promise<readonly GstarDataSourceSnapshot[]>

  /**
   * Persist one station's enablement override for a loaded source plugin.
   * @param request - Station, loaded source id, and effective enablement.
   * @returns the updated source snapshot.
   */
  abstract setEnabled(request: GstarDataSourceSetEnabledRequest): Promise<GstarDataSourceSnapshot>

  /**
   * Execute one enabled direct source plugin.
   * @param request - Station and loaded source id to run.
   * @returns completion metadata after the source commits successfully.
   */
  abstract synchronize(
    request: GstarDataSourceSynchronizeRequest,
  ): Promise<GstarDataSourceSynchronizationSnapshot>

  /**
   * Remote adapter for {@link list}.
   * @param request - Classified station whose loaded sources are projected.
   * @returns immutable source snapshots with effective station enablement.
   */
  @Remote('list')
  remoteExportList(request: GstarDataSourceListRequest): Promise<readonly GstarDataSourceSnapshot[]> {
    return this.list(request)
  }

  /**
   * Remote adapter for {@link setEnabled}.
   * @param request - Station, loaded source id, and effective enablement.
   * @returns the updated source snapshot.
   */
  @Remote('setEnabled')
  remoteExportSetEnabled(request: GstarDataSourceSetEnabledRequest): Promise<GstarDataSourceSnapshot> {
    return this.setEnabled(request)
  }

  /**
   * Remote adapter for {@link synchronize}.
   * @param request - Station and enabled direct source to execute.
   * @returns completion metadata after the source commits successfully.
   */
  @Remote('synchronize')
  remoteExportSynchronize(
    request: GstarDataSourceSynchronizeRequest,
  ): Promise<GstarDataSourceSynchronizationSnapshot> {
    return this.synchronize(request)
  }
}

export default GstarDataSourceService
