/**
 * storage-domain Provider for GSTAR station spatial assets.
 * @module @deepseek-ai/dsh-gstar-spatial-storage
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import GstarSpatialService from '@deepseek-ai/dsh-gstar-spatial'
import type {
  GstarAoiSnapshot, GstarSpatialPatchRequest, GstarSpatialSnapshot,
} from '@deepseek-ai/dsh-gstar-spatial/types'
import type {} from '@deepseek-ai/dsh-gstar-site'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { gstarSpatialDomainSpec, type GstarSpatialRecord } from './spec.ts'

export {
  gstarAoiGeometryRecord, gstarAoiRecord, gstarCoordinateRecord,
  gstarEntityRecord, gstarLinearRingRecord, gstarProvenanceRecord,
  gstarSpatialDomainSpec, gstarSpatialRecord,
} from './spec.ts'
export type { GstarSpatialRecord } from './spec.ts'

type GstarAoiRecord = GstarSpatialRecord['aois'][number]

/** Copy a coordinate while omitting absent optional fields at the exact-type boundary. */
function copyCoordinate(coordinate: {
  readonly longitude: number
  readonly latitude: number
  readonly height?: number | undefined
}) {
  const base = { longitude: coordinate.longitude, latitude: coordinate.latitude }
  return coordinate.height === undefined ? base : { ...base, height: coordinate.height }
}

/** Deep-copy Polygon and MultiPolygon coordinates across readonly/storage boundaries. */
function copyGeometry(geometry: GstarAoiSnapshot['geometry'] | GstarAoiRecord['geometry']) {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon' as const,
      coordinates: geometry.coordinates.map(ring => ring.map(copyCoordinate)),
    }
  }
  return {
    type: 'MultiPolygon' as const,
    coordinates: geometry.coordinates.map(polygon => polygon.map(ring => ring.map(copyCoordinate))),
  }
}

/** Deep-copy one AOI and omit undefined provenance properties. */
function copyAoi(aoi: GstarAoiSnapshot | GstarAoiRecord) {
  return {
    id: aoi.id,
    name: aoi.name,
    category: aoi.category,
    geometry: copyGeometry(aoi.geometry),
    entities: aoi.entities.map(entity => ({
      id: entity.id,
      type: entity.type,
      fields: { ...entity.fields },
    })),
    provenance: aoi.provenance.map(source => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      retrievedAt: source.retrievedAt,
      ...(source.sourceUrl === undefined ? {} : { sourceUrl: source.sourceUrl }),
      ...(source.license === undefined ? {} : { license: source.license }),
      ...(source.checksum === undefined ? {} : { checksum: source.checksum }),
    })),
    updatedAt: aoi.updatedAt,
  }
}

/** Convert a durable mutable AOI record into the public readonly projection. */
function aoiSnapshot(record: GstarAoiRecord): GstarAoiSnapshot {
  return copyAoi(record)
}

/** Convert a public readonly AOI projection into a durable mutable record. */
function aoiRecord(aoi: GstarAoiSnapshot): GstarAoiRecord {
  return copyAoi(aoi)
}

/** Copy one durable record into the immutable product projection. */
function snapshot(workspaceId: WorkspaceId, record?: GstarSpatialRecord): GstarSpatialSnapshot {
  return Object.freeze({
    workspaceId,
    ...(record?.location === undefined ? {} : { location: Object.freeze(copyCoordinate(record.location)) }),
    aois: Object.freeze((record?.aois ?? []).map(aoiSnapshot)),
    ...(record === undefined ? {} : { updatedAt: record.updatedAt }),
  })
}

/** Durable spatial provider restricted to Workspaces classified as GSTAR stations. */
export class StorageGstarSpatialService extends GstarSpatialService {
  static inject = ['storageDomain', 'gstarSites']

  private stations?: KvTable<WorkspaceId, GstarSpatialRecord>
  private operationTail: Promise<void> = Promise.resolve()
  private operationAdmissionOpen = true

  /** @param ctx - Host context carrying storage and station capabilities. */
  constructor(ctx: Context) {
    super(ctx)
  }

  /** Open the spatial domain and bind its write chain to Provider disposal. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(gstarSpatialDomainSpec)
    this.ctx.effect(() => async () => {
      this.operationAdmissionOpen = false
      await this.operationTail
      await domain.close()
    }, 'gstar-spatial-storage.domainClose')
    this.stations = domain.table('stations')
  }

  override async list(): Promise<readonly GstarSpatialSnapshot[]> {
    const stations = this.requireStations()
    const sites = await this.ctx.gstarSites.list()
    return Object.freeze(sites.map(site => snapshot(site.workspaceId, stations.get(site.workspaceId))))
  }

  override patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> {
    if (request.location === undefined && request.aois === undefined) {
      return Promise.reject(new Error('gstarSpatial.patch requires location or aois'))
    }
    return this.enqueueOperation(async () => {
      const sites = await this.ctx.gstarSites.list()
      if (!sites.some(site => site.workspaceId === request.workspaceId)) {
        throw new Error(`gstarSpatial.patch: Workspace ${request.workspaceId} is not a GSTAR station`)
      }
      const stations = this.requireStations()
      const current = stations.get(request.workspaceId)
      const next: GstarSpatialRecord = {
        ...(request.location === undefined
          ? current?.location === undefined ? {} : { location: current.location }
          : { location: copyCoordinate(request.location) }),
        aois: request.aois === undefined ? current?.aois ?? [] : request.aois.map(aoiRecord),
        updatedAt: new Date().toISOString(),
      }
      await stations.put(request.workspaceId, next)
      return snapshot(request.workspaceId, next)
    })
  }

  /** Serialize membership checks and durable spatial commits. */
  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.operationAdmissionOpen) {
      return Promise.reject(new Error('GSTAR spatial storage is disposing'))
    }
    const attempt = this.operationTail.then(operation)
    this.operationTail = attempt.then(() => {}, () => {})
    return attempt
  }

  /** Resolve the initialized spatial table. */
  private requireStations(): KvTable<WorkspaceId, GstarSpatialRecord> {
    if (this.stations === undefined) throw new Error('GSTAR spatial storage is not initialized')
    return this.stations
  }
}

export default StorageGstarSpatialService
