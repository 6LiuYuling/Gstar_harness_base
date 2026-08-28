/** React-free GSTAR spatial projection and Host action runtime. */

import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore, type ClientContext, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-gstar-spatial/remote'
import type {
  GstarDataSourceSnapshot, GstarSpatialLocateRequest, GstarSpatialPatchRequest,
  GstarSpatialRefreshAoisRequest, GstarSpatialSnapshot,
} from '@deepseek-ai/dsh-gstar-spatial/types'

/** Host-backed spatial-list state consumed by the GSTAR root component. */
export interface GstarSpatialListState {
  readonly items: readonly GstarSpatialSnapshot[]
  readonly phase: 'loading' | 'ready' | 'error'
  readonly error?: string
}

/** Host-backed public source catalog state consumed by the GSTAR root component. */
export interface GstarSourceListState {
  readonly items: readonly GstarDataSourceSnapshot[]
  readonly phase: 'loading' | 'ready' | 'error'
  readonly error?: string
}

/** Browser object layer for the GSTAR-only `gstarSpatial` Remote namespace. */
export class GstarSpatialRuntime {
  /** Immutable spatial projection restricted by the Host to classified stations. */
  readonly list: SnapshotStore<GstarSpatialListState> = createSnapshotStore({
    items: [],
    phase: 'loading',
  })
  /** Direct acquisition and authoritative reference sources published by the Host. */
  readonly sources: SnapshotStore<GstarSourceListState> = createSnapshotStore({
    items: [],
    phase: 'loading',
  })
  private loadGeneration = 0
  private sourceGeneration = 0

  /** @param remote - Generated spatial Remote namespace mounted by the gstar Client assembly. */
  constructor(private readonly remote: ClientContext['remote']['gstarSpatial']) {}

  /** Refresh the complete station spatial projection. */
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

  /** Refresh the Provider-owned public source catalog. */
  async loadSources(): Promise<void> {
    const generation = ++this.sourceGeneration
    this.sources.set({ items: this.sources.getSnapshot().items, phase: 'loading' })
    const result = await this.remote.listSources()
    if (generation !== this.sourceGeneration) return
    if (!result.ok) {
      this.sources.set({
        items: this.sources.getSnapshot().items,
        phase: 'error',
        error: `${result.error.code}: ${result.error.message}`,
      })
      return
    }
    this.sources.set({ items: result.value, phase: 'ready' })
  }

  /**
   * Patch station spatial data and refresh the authoritative projection.
   * @param request - Spatial fields to commit for one station.
   * @returns the committed spatial snapshot.
   */
  async patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> {
    const result = await this.remote.patch(request)
    if (!result.ok) {
      throw new Error(`gstarSpatial.patch failed: ${result.error.code}: ${result.error.message}`)
    }
    await this.load()
    return result.value
  }

  /**
   * Resolve a station name on the Host, persist the marker, and refresh the projection.
   * @param request - Station identity and location query.
   * @returns the committed spatial snapshot.
   */
  async locate(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot> {
    const result = await this.remote.locate(request)
    if (!result.ok) {
      throw new Error(`gstarSpatial.locate failed: ${result.error.code}: ${result.error.message}`)
    }
    await this.load()
    return result.value
  }

  /**
   * Fetch current public AOIs on the Host, persist them, and refresh the projection.
   * @param request - Station whose resolved bounds constrain the public-data query.
   * @returns the committed spatial snapshot.
   */
  async refreshAois(request: GstarSpatialRefreshAoisRequest): Promise<GstarSpatialSnapshot> {
    const result = await this.remote.refreshAois(request)
    if (!result.ok) {
      throw new Error(`gstarSpatial.refreshAois failed: ${result.error.code}: ${result.error.message}`)
    }
    await this.load()
    return result.value
  }
}
