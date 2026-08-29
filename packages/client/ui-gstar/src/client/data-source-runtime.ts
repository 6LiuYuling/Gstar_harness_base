/** React-free station data-source configuration and synchronization runtime. */

import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore, type ClientContext, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-gstar-data-source/remote'
import type {
  GstarDataSourceListRequest, GstarDataSourceSetEnabledRequest, GstarDataSourceSnapshot,
  GstarDataSourceSynchronizationSnapshot, GstarDataSourceSynchronizeRequest,
} from '@deepseek-ai/dsh-gstar-data-source/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** Loaded plugins and effective enablement for the selected GSTAR station. */
export interface GstarDataSourceListState {
  readonly workspaceId?: WorkspaceId
  readonly items: readonly GstarDataSourceSnapshot[]
  readonly phase: 'idle' | 'loading' | 'ready' | 'error'
  readonly error?: string
}

/** Browser object layer for the station-aware `gstarDataSources` Remote namespace. */
export class GstarDataSourceRuntime {
  /** Loaded source plugins projected through one station's durable selection. */
  readonly list: SnapshotStore<GstarDataSourceListState> = createSnapshotStore({
    items: [],
    phase: 'idle',
  })
  private loadGeneration = 0

  /** @param remote - Generated data-source Remote mounted by the GSTAR Client assembly. */
  constructor(private readonly remote: ClientContext['remote']['gstarDataSources']) {}

  /**
   * Load the dynamic plugin registry with effective enablement for one station.
   * @param request - Classified station whose effective source catalog is requested.
   * @returns after the latest matching Remote response updates the snapshot store.
   */
  async load(request: GstarDataSourceListRequest): Promise<void> {
    const generation = ++this.loadGeneration
    const current = this.list.getSnapshot()
    this.list.set({
      workspaceId: request.workspaceId,
      items: current.workspaceId === request.workspaceId ? current.items : [],
      phase: 'loading',
    })
    const result = await this.remote.list(request)
    if (generation !== this.loadGeneration) return
    if (!result.ok) {
      this.list.set({
        workspaceId: request.workspaceId,
        items: this.list.getSnapshot().items,
        phase: 'error',
        error: `${result.error.code}: ${result.error.message}`,
      })
      return
    }
    this.list.set({ workspaceId: request.workspaceId, items: result.value, phase: 'ready' })
  }

  /**
   * Persist one source selection, then refresh that station's effective plugin list.
   * @param request - Station, loaded source id, and enablement to persist.
   * @returns the source snapshot returned by the successful Remote mutation.
   */
  async setEnabled(request: GstarDataSourceSetEnabledRequest): Promise<GstarDataSourceSnapshot> {
    const result = await this.remote.setEnabled(request)
    if (!result.ok) {
      throw new Error(`gstarDataSources.setEnabled failed: ${result.error.code}: ${result.error.message}`)
    }
    await this.load({ workspaceId: request.workspaceId })
    return result.value
  }

  /**
   * Execute one enabled direct plugin and return its publication summary.
   * @param request - Station and enabled direct source to synchronize.
   * @returns successful source completion metadata from the Host.
   */
  async synchronize(
    request: GstarDataSourceSynchronizeRequest,
  ): Promise<GstarDataSourceSynchronizationSnapshot> {
    const result = await this.remote.synchronize(request)
    if (!result.ok) {
      throw new Error(`gstarDataSources.synchronize failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
}
