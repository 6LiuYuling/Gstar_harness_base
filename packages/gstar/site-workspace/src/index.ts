/**
 * DSH Workspace-backed provider for the GSTAR station service.
 * @module @deepseek-ai/dsh-gstar-site-workspace
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import GstarSiteService from '@deepseek-ai/dsh-gstar-site'
import type { GstarSiteCreateRequest, GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { gstarSiteWorkspaceDomainSpec, type GstarSiteMembershipRecord } from './spec.ts'

export {
  gstarSiteMembershipRecord, gstarSiteWorkspaceDomainSpec,
} from './spec.ts'
export type { GstarSiteMembershipRecord } from './spec.ts'

/** Copy one mutable Workspace entity projection into a wire-safe snapshot. */
function snapshot(workspace: Workspace): GstarSiteSnapshot {
  return Object.freeze({
    workspaceId: workspace.id,
    path: workspace.path,
    title: workspace.title,
    sessionCount: workspace.sessionIds.length,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  })
}

/** Workspace-backed station provider with durable GSTAR membership classification. */
export class WorkspaceGstarSiteService extends GstarSiteService {
  static inject = ['workspaceRegistry', 'storageDomain']

  private sites?: KvTable<WorkspaceId, GstarSiteMembershipRecord>
  private operationTail: Promise<void> = Promise.resolve()
  private operationAdmissionOpen = true

  /**
   * @param ctx - Host context carrying the Workspace registry.
   */
  constructor(ctx: Context) {
    super(ctx)
  }

  /** Open the GSTAR membership sidecar and bind its lifecycle to this Provider. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(gstarSiteWorkspaceDomainSpec)
    this.ctx.effect(() => async () => {
      this.operationAdmissionOpen = false
      await this.operationTail
      await domain.close()
    }, 'gstar-site-workspace.domainClose')
    this.sites = domain.table('sites')
  }

  override list(): Promise<readonly GstarSiteSnapshot[]> {
    const sites = this.requireSites()
    return Promise.resolve(Object.freeze(
      this.ctx.workspaceRegistry.list()
        .filter(workspace => sites.get(workspace.id) !== undefined)
        .map(snapshot),
    ))
  }

  override create(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot> {
    return this.enqueueOperation(async () => {
      const workspace = await this.ctx.workspaceRegistry.create(request.path, request.title)
      const sites = this.requireSites()
      if (sites.get(workspace.id) === undefined) {
        await sites.put(workspace.id, { registeredAt: new Date().toISOString() })
      }
      return snapshot(workspace)
    })
  }

  /** Serialize station creation and membership commits, and reject admission during disposal. */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.operationAdmissionOpen) {
      return Promise.reject(new Error('GSTAR site membership is disposing'))
    }
    const attempt = this.operationTail.then(operation)
    this.operationTail = attempt.then(() => {}, () => {})
    return attempt
  }

  /** Resolve the initialized membership table. */
  private requireSites(): KvTable<WorkspaceId, GstarSiteMembershipRecord> {
    if (this.sites === undefined) throw new Error('GSTAR site membership is not initialized')
    return this.sites
  }
}

export default WorkspaceGstarSiteService
