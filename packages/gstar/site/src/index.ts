/**
 * GSTAR station domain built over the active DSH Workspace provider.
 * @module @deepseek-ai/dsh-gstar-site
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { GstarSiteCreateRequest, GstarSiteSnapshot } from './types.ts'

export type { GstarSiteCreateRequest, GstarSiteSnapshot } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** GSTAR station operations over the deployment's Workspace implementation. */
    gstarSites: GstarSiteService
  }
}

/** Provider-neutral GSTAR station service and its Host Remote adapter. */
export abstract class GstarSiteService extends TypertRemoteService {
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
}

export default GstarSiteService
