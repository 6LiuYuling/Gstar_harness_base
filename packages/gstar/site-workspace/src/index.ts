/**
 * DSH Workspace-backed provider for the GSTAR station service.
 * @module @deepseek-ai/dsh-gstar-site-workspace
 */

import type { Context } from '@deepseek-ai/cordis'
import GstarSiteService from '@deepseek-ai/dsh-gstar-site'
import type { GstarSiteCreateRequest, GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import type { Workspace } from '@deepseek-ai/dsh-workspace'

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

/** GSTAR station provider delegating identity and durability to `ctx.workspaceRegistry`. */
export class WorkspaceGstarSiteService extends GstarSiteService {
  static inject = ['workspaceRegistry']

  /**
   * @param ctx - Host context carrying the Workspace registry.
   */
  constructor(ctx: Context) {
    super(ctx)
  }

  override list(): Promise<readonly GstarSiteSnapshot[]> {
    return Promise.resolve(Object.freeze(this.ctx.workspaceRegistry.list().map(snapshot)))
  }

  override async create(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot> {
    return snapshot(await this.ctx.workspaceRegistry.create(request.path, request.title))
  }
}

export default WorkspaceGstarSiteService
