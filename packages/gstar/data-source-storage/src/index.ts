/**
 * storage-domain Provider for the GSTAR data-source plugin registry and station selections.
 * @module @deepseek-ai/dsh-gstar-data-source-storage
 */

import { Service } from '@deepseek-ai/cordis'
import GstarDataSourceService from '@deepseek-ai/dsh-gstar-data-source'
import type {
  GstarDataSourceId, GstarDataSourceListRequest,
  GstarDataSourceSetEnabledRequest, GstarDataSourceSnapshot,
  GstarDataSourceSynchronizationSnapshot, GstarDataSourceSynchronizeRequest,
} from '@deepseek-ai/dsh-gstar-data-source/types'
import type { GstarDataSourceProvider } from '@deepseek-ai/dsh-gstar-data-source'
import type { GstarSiteDeletionPreparation } from '@deepseek-ai/dsh-gstar-site'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import {
  gstarDataSourceDomainSpec,
  type GstarDataSourceSelectionRecord,
} from './spec.ts'

export {
  gstarDataSourceDomainSpec, gstarDataSourceSelectionRecord,
} from './spec.ts'
export type { GstarDataSourceSelectionRecord } from './spec.ts'

/** Copy a live provider descriptor into a station-specific immutable projection. */
function snapshot(provider: GstarDataSourceProvider, enabled: boolean): GstarDataSourceSnapshot {
  const descriptor = provider.descriptor
  return Object.freeze({
    id: descriptor.id,
    name: descriptor.name,
    publisher: descriptor.publisher,
    url: descriptor.url,
    categories: Object.freeze([...descriptor.categories]),
    capabilities: Object.freeze([...descriptor.capabilities]),
    accessMode: descriptor.accessMode,
    ...(descriptor.license === undefined ? {} : { license: descriptor.license }),
    enabled,
    defaultEnabled: descriptor.defaultEnabled,
    synchronizable: provider.synchronize !== undefined,
  })
}

/** Durable registry Provider restricted to Workspaces classified as GSTAR stations. */
export class StorageGstarDataSourceService extends GstarDataSourceService {
  static inject = ['storageDomain', 'gstarSites']

  private selections: KvTable<WorkspaceId, GstarDataSourceSelectionRecord> | undefined
  private readonly providers = new Map<GstarDataSourceId, GstarDataSourceProvider>()
  private readonly deletingStations = new Set<WorkspaceId>()
  private operationTail: Promise<void> = Promise.resolve()
  private operationAdmissionOpen = true

  /** Open the selection domain and bind its write chain to Provider disposal. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(gstarDataSourceDomainSpec)
    this.selections = domain.table('stations')
    try {
      const removeDeletionParticipant = this.ctx.gstarSites.registerDeletionParticipant(
        workspaceId => this.removeStationSelection(workspaceId),
      )
      this.ctx.effect(() => async () => {
        removeDeletionParticipant()
        this.operationAdmissionOpen = false
        await this.operationTail
        await domain.close()
      }, 'gstar-data-source-storage.domainClose')
    } catch (cause) {
      this.selections = undefined
      await domain.close()
      throw cause
    }
  }

  override register(provider: GstarDataSourceProvider): () => void {
    const id = provider.descriptor.id
    if (this.providers.has(id)) throw new Error(`GSTAR data-source plugin ${id} is already registered`)
    if (provider.descriptor.accessMode === 'direct' && provider.synchronize === undefined) {
      throw new Error(`GSTAR direct data-source plugin ${id} must provide synchronize()`)
    }
    if (provider.descriptor.accessMode === 'reference' && provider.synchronize !== undefined) {
      throw new Error(`GSTAR reference data-source plugin ${id} cannot provide synchronize()`)
    }
    const providers = this.providers
    const dispose = this.ctx.effect(function* () {
      providers.set(id, provider)
      yield () => {
        if (providers.get(id) === provider) providers.delete(id)
      }
    }, 'gstarDataSources.register()')
    return () => { void dispose() }
  }

  override async list(request: GstarDataSourceListRequest): Promise<readonly GstarDataSourceSnapshot[]> {
    await this.assertStation(request.workspaceId, 'list')
    const overrides = this.requireSelections().get(request.workspaceId)?.overrides ?? {}
    return Object.freeze([...this.providers.values()]
      .sort((left, right) => left.descriptor.id.localeCompare(right.descriptor.id))
      .map(provider => snapshot(
        provider,
        overrides[provider.descriptor.id] ?? provider.descriptor.defaultEnabled,
      )))
  }

  override setEnabled(request: GstarDataSourceSetEnabledRequest): Promise<GstarDataSourceSnapshot> {
    const provider = this.providers.get(request.sourceId)
    if (provider === undefined) {
      return Promise.reject(new Error(`GSTAR data-source plugin ${request.sourceId} is not loaded`))
    }
    return this.enqueueOperation(async () => {
      await this.assertStation(request.workspaceId, 'setEnabled')
      if (this.deletingStations.has(request.workspaceId)) {
        throw new Error(`gstarDataSources.setEnabled: GSTAR station ${request.workspaceId} is being deleted`)
      }
      if (this.providers.get(request.sourceId) !== provider) {
        throw new Error(`GSTAR data-source plugin ${request.sourceId} was unloaded before configuration committed`)
      }
      const selections = this.requireSelections()
      const current = selections.get(request.workspaceId)
      const next: GstarDataSourceSelectionRecord = {
        overrides: { ...current?.overrides, [request.sourceId]: request.enabled },
        updatedAt: new Date().toISOString(),
      }
      await selections.put(request.workspaceId, next)
      return snapshot(provider, request.enabled)
    })
  }

  override async synchronize(
    request: GstarDataSourceSynchronizeRequest,
  ): Promise<GstarDataSourceSynchronizationSnapshot> {
    await this.assertStation(request.workspaceId, 'synchronize')
    const provider = this.providers.get(request.sourceId)
    if (provider === undefined) throw new Error(`GSTAR data-source plugin ${request.sourceId} is not loaded`)
    const configured = this.requireSelections().get(request.workspaceId)
    const enabled = configured?.overrides[request.sourceId] ?? provider.descriptor.defaultEnabled
    if (!enabled) {
      throw new Error(`GSTAR data-source plugin ${request.sourceId} is disabled for station ${request.workspaceId}`)
    }
    if (provider.synchronize === undefined) {
      throw new Error(`GSTAR data-source plugin ${request.sourceId} is reference-only`)
    }
    const message = await provider.synchronize(request.workspaceId)
    return Object.freeze({
      workspaceId: request.workspaceId,
      sourceId: request.sourceId,
      synchronizedAt: new Date().toISOString(),
      message,
    })
  }

  /** Verify station membership immediately before a read or admitted operation. */
  private async assertStation(workspaceId: WorkspaceId, operation: string): Promise<void> {
    const sites = await this.ctx.gstarSites.list()
    if (!sites.some(site => site.workspaceId === workspaceId)) {
      throw new Error(`gstarDataSources.${operation}: Workspace ${workspaceId} is not a GSTAR station`)
    }
  }

  /** Remove source selection before station membership deletion and return a durable rollback. */
  private removeStationSelection(workspaceId: WorkspaceId): Promise<GstarSiteDeletionPreparation> {
    this.deletingStations.add(workspaceId)
    const preparation = this.enqueueOperation(async () => {
      const selections = this.requireSelections()
      const current = selections.get(workspaceId)
      try {
        if (current !== undefined) await selections.delete(workspaceId)
      } catch (cause) {
        this.deletingStations.delete(workspaceId)
        throw cause
      }
      return {
        commit: () => { this.deletingStations.delete(workspaceId) },
        rollback: async () => {
          try {
            if (current !== undefined) {
              await this.enqueueOperation(async () => { await selections.put(workspaceId, current) })
            }
          } finally {
            this.deletingStations.delete(workspaceId)
          }
        },
      }
    })
    return preparation.catch((cause: unknown) => {
      this.deletingStations.delete(workspaceId)
      throw cause
    })
  }

  /** Serialize durable selection writes and station deletion compensation. */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.operationAdmissionOpen) {
      return Promise.reject(new Error('GSTAR data-source storage is disposing'))
    }
    const attempt = this.operationTail.then(operation)
    this.operationTail = attempt.then(() => {}, () => {})
    return attempt
  }

  /** Resolve the initialized station-selection table. */
  private requireSelections(): KvTable<WorkspaceId, GstarDataSourceSelectionRecord> {
    if (this.selections === undefined) throw new Error('GSTAR data-source storage is not initialized')
    return this.selections
  }
}

export default StorageGstarDataSourceService
