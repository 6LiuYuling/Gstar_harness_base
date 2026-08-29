/**
 * Provider-neutral GSTAR station spatial-asset service.
 * @module @deepseek-ai/dsh-gstar-spatial
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  GstarSpatialLocateRequest, GstarSpatialPatchRequest,
  GstarSpatialRefreshAoisRequest, GstarSpatialSnapshot,
} from './types.ts'

export type {
  GstarAoiCategory, GstarAoiGeometry, GstarAoiSnapshot, GstarCoordinate,
  GstarEntityFieldValue,
  GstarEntitySnapshot, GstarLinearRing, GstarMultiPolygonGeometry,
  GstarPolygonGeometry, GstarProvenanceSnapshot, GstarSpatialLocateRequest,
  GstarSpatialPatchRequest, GstarSpatialRefreshAoisRequest, GstarSpatialSnapshot,
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
   * Patch location, station boundary, or AOIs and retain every omitted field.
   * @param request - Spatial fields to commit for one station.
   * @returns the committed immutable projection.
   */
  abstract patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot>

  /**
   * Resolve a user-supplied station name and persist its marker and available boundary.
   * @param request - Station identity and geocoding query.
   * @returns the committed immutable spatial projection.
   */
  abstract locate(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot>

  /**
   * Fetch current public AOIs for one station and replace its durable AOI publication.
   * @param request - Station identity whose resolved boundary or marker defines the query area.
   * @returns the committed immutable spatial projection.
   */
  abstract refreshAois(request: GstarSpatialRefreshAoisRequest): Promise<GstarSpatialSnapshot>

  /**
   * Remote adapter for {@link list}.
   * @returns immutable station spatial projections.
   */
  @Remote('list')
  remoteExportList(): Promise<readonly GstarSpatialSnapshot[]> {
    return this.list()
  }

  /**
   * Remote adapter for {@link patch}.
   * @param request - Spatial fields to commit for one station.
   * @returns the committed spatial snapshot.
   */
  @Remote('patch')
  remoteExportPatch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> {
    return this.patch(request)
  }

  /**
   * Remote adapter for {@link locate}.
   * @param request - Station identity and location query.
   * @returns the committed spatial snapshot.
   */
  @Remote('locate')
  remoteExportLocate(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot> {
    return this.locate(request)
  }

}

export default GstarSpatialService
