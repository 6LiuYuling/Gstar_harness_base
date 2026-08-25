/**
 * GSTAR station domain built over the active DSH Workspace provider.
 * @module @deepseek-ai/dsh-gstar-site
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  GstarSiteCreateRequest, GstarSiteDeleteRequest, GstarSiteSnapshot,
} from './types.ts'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

export type {
  GstarSiteCreateRequest, GstarSiteDeleteRequest, GstarSiteSnapshot,
} from './types.ts'

/** One prepared station-owned deletion with commit and compensation hooks. */
export interface GstarSiteDeletionPreparation {
  /** Release transient deletion guards after membership removal succeeds. */
  commit(): void
  /** Restore the participant's durable state after deletion fails. */
  rollback(): Promise<void>
}

/** Clean one station-owned domain before its GSTAR membership row is removed. */
export type GstarSiteDeletionParticipant = (
  workspaceId: WorkspaceId,
) => Promise<GstarSiteDeletionPreparation | void>

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** GSTAR station operations over the deployment's Workspace implementation. */
    gstarSites: GstarSiteService
  }
}

/** Provider-neutral GSTAR station service and its Host Remote adapter. */
export abstract class GstarSiteService extends TypertRemoteService {
  private readonly deletionParticipants = new Set<GstarSiteDeletionParticipant>()

  /**
   * @param ctx - Host context receiving the `gstarSites` service.
   */
  constructor(ctx: Context) {
    super(ctx, 'gstarSites')
  }

  /**
   * List every station in the Workspace registry's durable order.
   * @returns immutable GSTAR station snapshots.
   */
  abstract list(): Promise<readonly GstarSiteSnapshot[]>

  /**
   * Create or resolve a station through the active Workspace provider.
   * @param request - Existing directory and optional first-create title.
   * @returns the durable station snapshot.
   */
  abstract create(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot>

  /**
   * Remove a station's GSTAR classification and station-owned domain data.
   * The generic Workspace, directory, and Session logs remain available to `dsh web`.
   * @param request - Classified station Workspace identity.
   * @returns the removed station snapshot.
   */
  abstract delete(request: GstarSiteDeleteRequest): Promise<GstarSiteSnapshot>

  /**
   * Register a Host-side cleanup participant for station deletion.
   * @param participant - Durable cleanup returning an optional compensating rollback.
   * @returns disposer that removes the participant from future deletions.
   */
  registerDeletionParticipant(participant: GstarSiteDeletionParticipant): () => void {
    this.deletionParticipants.add(participant)
    return () => { this.deletionParticipants.delete(participant) }
  }

  /**
   * Run every registered cleanup before the membership commit.
   * @param workspaceId - Station whose owned domains must be removed.
   * @returns aggregate commit and rollback for all successfully prepared participants.
   */
  protected async prepareDeletion(workspaceId: WorkspaceId): Promise<GstarSiteDeletionPreparation> {
    const preparations: GstarSiteDeletionPreparation[] = []
    try {
      for (const participant of [...this.deletionParticipants]) {
        const preparation = await participant(workspaceId)
        if (preparation !== undefined) preparations.push(preparation)
      }
    } catch (cause) {
      const failures = await this.runRollbacks(preparations)
      if (failures.length === 0) throw cause
      throw new AggregateError([cause, ...failures], 'GSTAR site deletion preparation and rollback failed')
    }
    return {
      commit: () => {
        for (const preparation of preparations) {
          try {
            preparation.commit()
          } catch (error) {
            this.ctx.logger.warn(`GSTAR site deletion commit finalizer failed: ${String(error)}`)
          }
        }
      },
      rollback: async () => {
        const failures = await this.runRollbacks(preparations)
        if (failures.length > 0) throw new AggregateError(failures, 'GSTAR site deletion rollback failed')
      },
    }
  }

  /** Run compensating actions in reverse participant order. */
  private async runRollbacks(preparations: GstarSiteDeletionPreparation[]): Promise<unknown[]> {
    const failures: unknown[] = []
    for (const preparation of [...preparations].reverse()) {
      try {
        await preparation.rollback()
      } catch (error) {
        failures.push(error)
      }
    }
    return failures
  }

  /**
   * Remote adapter for {@link list}; decorators cannot annotate abstract methods.
   * @returns immutable GSTAR station snapshots.
   */
  @Remote('list')
  remoteExportList(): Promise<readonly GstarSiteSnapshot[]> {
    return this.list()
  }

  /**
   * Remote adapter for {@link create}; decorators cannot annotate abstract methods.
   * @param request - Existing directory and optional first-create title.
   * @returns the durable station snapshot.
   */
  @Remote('create')
  remoteExportCreate(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot> {
    return this.create(request)
  }

  /**
   * Remote adapter for {@link delete}; decorators cannot annotate abstract methods.
   * @param request - Classified station Workspace identity.
   * @returns the removed station snapshot.
   */
  @Remote('delete')
  remoteExportDelete(request: GstarSiteDeleteRequest): Promise<GstarSiteSnapshot> {
    return this.delete(request)
  }
}

export default GstarSiteService
