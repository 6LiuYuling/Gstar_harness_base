/**
 * Provider-neutral GSTAR station spatial-asset service.
 * @module @deepseek-ai/dsh-gstar-spatial
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { GstarSpatialPatchRequest, GstarSpatialSnapshot } from './types.ts'

export type {
  GstarAoiGeometry, GstarAoiSnapshot, GstarCoordinate, GstarEntityFieldValue,
  GstarEntitySnapshot, GstarLinearRing, GstarMultiPolygonGeometry,
  GstarPolygonGeometry, GstarProvenanceSnapshot, GstarSpatialPatchRequest,
  GstarSpatialSnapshot,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** GSTAR station locations, AOIs, entities, and source provenance. */
    gstarSpatial: GstarSpatialService
  }
}

/** Provider-neutral GSTAR spatial service and its Host Remote adapter. */
export abstract class GstarSpatialService extends TypertRemoteService {
  /**
   * @param ctx - Host context receiving the `gstarSpatial` service.
   */
  constructor(ctx: Context) {
    super(ctx, 'gstarSpatial')
  }

  /**
   * List spatial projections for the requested station roster.
   * @returns one immutable projection per classified station, in station order.
   */
  abstract list(): Promise<readonly GstarSpatialSnapshot[]>

  /**
   * Patch location or AOIs and retain every omitted field.
   * @param request - Spatial fields to commit for one station.
   * @returns the committed immutable projection.
   */
  abstract patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot>

  /** Remote adapter for {@link list}. */
  @Remote('list')
  remoteExportList(): Promise<readonly GstarSpatialSnapshot[]> {
    return this.list()
  }

  /** Remote adapter for {@link patch}. */
  @Remote('patch')
  remoteExportPatch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> {
    return this.patch(request)
  }
}

export default GstarSpatialService
