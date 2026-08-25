/** React-free GSTAR station list and Host action runtime. */

import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore, type ClientContext, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-gstar-site/remote'
import type {
  GstarSiteCreateRequest, GstarSiteDeleteRequest, GstarSiteSnapshot,
} from '@deepseek-ai/dsh-gstar-site/types'

/** Host-backed station-list state consumed by the GSTAR root component. */
export interface GstarSiteListState {
  readonly items: readonly GstarSiteSnapshot[]
  readonly phase: 'loading' | 'ready' | 'error'
  readonly error?: string
}

/** Browser object layer for the GSTAR-only `gstarSites` Remote namespace. */
export class GstarSiteRuntime {
  /** Immutable station projection; ordinary DSH Workspaces never enter it. */
  readonly list: SnapshotStore<GstarSiteListState> = createSnapshotStore({
    items: [],
    phase: 'loading',
  })
  private loadGeneration = 0

  /**
   * @param remote - Generated GSTAR Remote namespace mounted by the gstar Client assembly.
   */
  constructor(private readonly remote: ClientContext['remote']['gstarSites']) {}

  /** Refresh the complete station projection from the Host membership domain. */
  async load(): Promise<void> {
    const generation = ++this.loadGeneration
    this.list.set({ items: this.list.getSnapshot().items, phase: 'loading' })
    const result = await this.remote.list()
    if (generation !== this.loadGeneration) return
    if (!result.ok) {
      this.list.set({
        items: this.list.getSnapshot().items,
        phase: 'error',
        error: `${result.error.code}: ${result.error.message}`,
      })
      return
    }
    this.list.set({ items: result.value, phase: 'ready' })
  }

  /**
   * Register one Workspace as a GSTAR station and refresh the authoritative list.
   * @param request - Existing Host directory and optional station title.
   * @returns the committed station snapshot.
   */
  async create(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot> {
    const result = await this.remote.create(request)
    if (!result.ok) {
      throw new Error(`gstarSites.create failed: ${result.error.code}: ${result.error.message}`)
    }
    await this.load()
    return result.value
  }

  /** Remove station classification and refresh the authoritative list. */
  async delete(request: GstarSiteDeleteRequest): Promise<GstarSiteSnapshot> {
    const result = await this.remote.delete(request)
    if (!result.ok) {
      throw new Error(`gstarSites.delete failed: ${result.error.code}: ${result.error.message}`)
    }
    await this.load()
    return result.value
  }
}
