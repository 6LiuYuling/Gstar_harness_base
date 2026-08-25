/**
 * storage-domain Provider for GSTAR station spatial assets.
 * @module @deepseek-ai/dsh-gstar-spatial-storage
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import GstarSpatialService from '@deepseek-ai/dsh-gstar-spatial'
import type {
  GstarAoiGeometry, GstarAoiSnapshot, GstarCoordinate, GstarLinearRing, GstarSpatialLocateRequest,
  GstarSpatialPatchRequest, GstarSpatialSnapshot,
} from '@deepseek-ai/dsh-gstar-spatial/types'
import type { GstarSiteDeletionPreparation } from '@deepseek-ai/dsh-gstar-site'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type {} from '@deepseek-ai/dsh-web'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { gstarSpatialDomainSpec, type GstarSpatialRecord } from './spec.ts'

export {
  gstarAoiGeometryRecord, gstarAoiRecord, gstarCoordinateRecord,
  gstarEntityRecord, gstarLinearRingRecord, gstarProvenanceRecord,
  gstarSpatialDomainSpec, gstarSpatialRecord,
} from './spec.ts'
export type { GstarSpatialRecord } from './spec.ts'

type GstarAoiRecord = GstarSpatialRecord['aois'][number]

const NOMINATIM_SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const PHOTON_SEARCH_ENDPOINT = 'https://photon.komoot.io/api/'

interface NominatimResult {
  readonly lat?: unknown
  readonly lon?: unknown
  readonly boundingbox?: unknown
  readonly geojson?: unknown
}

interface PhotonResponse {
  readonly features?: unknown
}

interface PhotonFeature {
  readonly geometry?: unknown
}

interface PhotonPoint {
  readonly type?: unknown
  readonly coordinates?: unknown
}

interface Geocoder {
  readonly name: string
  url(query: string): URL
  decode(content: string): GeocoderResult | undefined
}

interface GeocoderResult {
  readonly location: GstarCoordinate
  readonly boundary?: GstarAoiGeometry
}

/** Candidate queries, removing a UI station suffix before falling back to the exact title. */
function locationQueries(value: string): readonly string[] {
  const query = value.trim()
  if (query.length === 0) throw new Error('gstarSpatial.locate requires a station name')
  const withoutSuffix = query.replace(/(?:局点|站点)$/u, '').trim()
  return withoutSuffix.length > 0 && withoutSuffix !== query ? [withoutSuffix, query] : [query]
}

/** Decode the first valid WGS84 point returned by Nominatim. */
function decodeJson(content: string): unknown {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (cause) {
    throw new Error('GSTAR geocoder returned invalid JSON', { cause })
  }
  return value
}

/** Validate and construct one WGS84 point. */
function coordinate(longitude: unknown, latitude: unknown): GstarCoordinate | undefined {
  const lon = typeof longitude === 'string' || typeof longitude === 'number'
    ? Number(longitude) : Number.NaN
  const lat = typeof latitude === 'string' || typeof latitude === 'number'
    ? Number(latitude) : Number.NaN
  return Number.isFinite(lon) && lon >= -180 && lon <= 180
    && Number.isFinite(lat) && lat >= -90 && lat <= 90
    ? { longitude: lon, latitude: lat }
    : undefined
}

/** Decode and validate one closed GeoJSON linear ring. */
function linearRing(value: unknown): GstarLinearRing | undefined {
  if (!Array.isArray(value) || value.length < 4) return undefined
  const positions: GstarCoordinate[] = []
  for (const candidate of value) {
    if (!Array.isArray(candidate)) return undefined
    const result = coordinate(candidate[0], candidate[1])
    if (result === undefined) return undefined
    positions.push(result)
  }
  const first = positions[0]
  const last = positions.at(-1)
  if (first === undefined || last === undefined
    || first.longitude !== last.longitude || first.latitude !== last.latitude) return undefined
  return positions
}

/** Decode one Polygon coordinate array. */
function polygonRings(value: unknown): readonly GstarLinearRing[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const rings: GstarLinearRing[] = []
  for (const candidate of value) {
    const ring = linearRing(candidate)
    if (ring === undefined) return undefined
    rings.push(ring)
  }
  return rings
}

/** Decode GeoJSON Polygon or MultiPolygon into the browser-safe GSTAR geometry. */
function geometry(value: unknown): GstarAoiGeometry | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const input = value as { readonly type?: unknown; readonly coordinates?: unknown }
  if (input.type === 'Polygon') {
    const coordinates = polygonRings(input.coordinates)
    return coordinates === undefined ? undefined : { type: 'Polygon', coordinates }
  }
  if (input.type === 'MultiPolygon' && Array.isArray(input.coordinates)) {
    const polygons: (readonly GstarLinearRing[])[] = []
    for (const polygon of input.coordinates) {
      const rings = polygonRings(polygon)
      if (rings === undefined) return undefined
      polygons.push(rings)
    }
    return polygons.length === 0 ? undefined : { type: 'MultiPolygon', coordinates: polygons }
  }
  return undefined
}

/** Convert Nominatim's south/north/west/east bounds into a closed rectangle. */
function boundingBoxGeometry(value: unknown): GstarAoiGeometry | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined
  const southWest = coordinate(value[2], value[0])
  const northEast = coordinate(value[3], value[1])
  if (southWest === undefined || northEast === undefined
    || southWest.longitude >= northEast.longitude || southWest.latitude >= northEast.latitude) return undefined
  return {
    type: 'Polygon',
    coordinates: [[
      southWest,
      { longitude: northEast.longitude, latitude: southWest.latitude },
      northEast,
      { longitude: southWest.longitude, latitude: northEast.latitude },
      southWest,
    ]],
  }
}

/** Decode the first valid WGS84 point and available place boundary returned by Nominatim. */
function decodeNominatim(content: string): GeocoderResult | undefined {
  const value = decodeJson(content)
  if (!Array.isArray(value)) throw new Error('GSTAR geocoder returned a non-array payload')
  for (const candidate of value as NominatimResult[]) {
    const location = coordinate(candidate.lon, candidate.lat)
    if (location === undefined) continue
    const boundary = geometry(candidate.geojson) ?? boundingBoxGeometry(candidate.boundingbox)
    return boundary === undefined ? { location } : { location, boundary }
  }
  return undefined
}

/** Decode the first valid GeoJSON Point returned by Photon. */
function decodePhoton(content: string): GeocoderResult | undefined {
  const value = decodeJson(content) as PhotonResponse | null
  if (value === null || typeof value !== 'object' || !Array.isArray(value.features)) {
    throw new Error('GSTAR Photon geocoder returned a non-FeatureCollection payload')
  }
  for (const feature of value.features as PhotonFeature[]) {
    if (feature === null || typeof feature !== 'object'
      || feature.geometry === null || typeof feature.geometry !== 'object') continue
    const geometry = feature.geometry as PhotonPoint
    if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) continue
    const location = coordinate(geometry.coordinates[0], geometry.coordinates[1])
    if (location !== undefined) return { location }
  }
  return undefined
}

const GEOCODERS: readonly Geocoder[] = [
  {
    name: 'Nominatim',
    url(query) {
      const url = new URL(NOMINATIM_SEARCH_ENDPOINT)
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('limit', '1')
      url.searchParams.set('accept-language', 'zh-CN')
      url.searchParams.set('polygon_geojson', '1')
      url.searchParams.set('polygon_threshold', '0.001')
      url.searchParams.set('q', query)
      return url
    },
    decode: decodeNominatim,
  },
  {
    name: 'Photon',
    url(query) {
      const url = new URL(PHOTON_SEARCH_ENDPOINT)
      url.searchParams.set('limit', '1')
      url.searchParams.set('lang', 'zh')
      url.searchParams.set('q', query)
      return url
    },
    decode: decodePhoton,
  },
]

/** Render the actionable portion of a fetch cause chain across the Remote boundary. */
function errorChain(value: unknown): string {
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current: unknown = value
  while (current !== undefined && current !== null && !seen.has(current) && messages.length < 4) {
    seen.add(current)
    const message = current instanceof Error ? current.message : String(current)
    if (messages.at(-1) !== message) messages.push(message)
    current = current instanceof Error ? current.cause : undefined
  }
  return messages.join(' <- ')
}

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
    ...(record?.boundary === undefined ? {} : { boundary: copyGeometry(record.boundary) }),
    aois: Object.freeze((record?.aois ?? []).map(aoiSnapshot)),
    ...(record === undefined ? {} : { updatedAt: record.updatedAt }),
  })
}

/** Durable spatial provider restricted to Workspaces classified as GSTAR stations. */
export class StorageGstarSpatialService extends GstarSpatialService {
  static inject = ['storageDomain', 'gstarSites', 'web']

  private stations: KvTable<WorkspaceId, GstarSpatialRecord> | undefined
  private readonly deletingStations = new Set<WorkspaceId>()
  private operationTail: Promise<void> = Promise.resolve()
  private operationAdmissionOpen = true

  /** @param ctx - Host context carrying storage and station capabilities. */
  constructor(ctx: Context) {
    super(ctx)
  }

  /** Open the spatial domain and bind its write chain to Provider disposal. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(gstarSpatialDomainSpec)
    this.stations = domain.table('stations')
    try {
      const removeDeletionParticipant = this.ctx.gstarSites.registerDeletionParticipant(
        workspaceId => this.removeStationAssets(workspaceId),
      )
      this.ctx.effect(() => async () => {
        removeDeletionParticipant()
        this.operationAdmissionOpen = false
        await this.operationTail
        await domain.close()
      }, 'gstar-spatial-storage.domainClose')
    } catch (cause) {
      this.stations = undefined
      await domain.close()
      throw cause
    }
  }

  override async list(): Promise<readonly GstarSpatialSnapshot[]> {
    const stations = this.requireStations()
    const sites = await this.ctx.gstarSites.list()
    return Object.freeze(sites.map(site => snapshot(site.workspaceId, stations.get(site.workspaceId))))
  }

  override patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> {
    if (request.location === undefined && request.boundary === undefined && request.aois === undefined) {
      return Promise.reject(new Error('gstarSpatial.patch requires location, boundary, or aois'))
    }
    return this.enqueueOperation(async () => {
      const sites = await this.ctx.gstarSites.list()
      if (!sites.some(site => site.workspaceId === request.workspaceId)) {
        throw new Error(`gstarSpatial.patch: Workspace ${request.workspaceId} is not a GSTAR station`)
      }
      if (this.deletingStations.has(request.workspaceId)) {
        throw new Error(`gstarSpatial.patch: GSTAR station ${request.workspaceId} is being deleted`)
      }
      const stations = this.requireStations()
      const current = stations.get(request.workspaceId)
      const boundary = request.boundary === undefined
        ? current?.boundary
        : request.boundary === null ? undefined : copyGeometry(request.boundary)
      const next: GstarSpatialRecord = {
        ...(request.location === undefined
          ? current?.location === undefined ? {} : { location: current.location }
          : { location: copyCoordinate(request.location) }),
        ...(boundary === undefined ? {} : { boundary }),
        aois: request.aois === undefined ? current?.aois ?? [] : request.aois.map(aoiRecord),
        updatedAt: new Date().toISOString(),
      }
      await stations.put(request.workspaceId, next)
      return snapshot(request.workspaceId, next)
    })
  }

  override async locate(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot> {
    const sites = await this.ctx.gstarSites.list()
    if (!sites.some(site => site.workspaceId === request.workspaceId)) {
      throw new Error(`gstarSpatial.locate: Workspace ${request.workspaceId} is not a GSTAR station`)
    }
    const failures: string[] = []
    let completedLookups = 0
    for (const query of locationQueries(request.query)) {
      for (const geocoder of GEOCODERS) {
        try {
          const result = await this.ctx.web.fetch({ url: geocoder.url(query).href })
          if (result.statusCode < 200 || result.statusCode >= 300) {
            throw new Error(`HTTP ${String(result.statusCode)}`)
          }
          if (result.truncated) throw new Error('response exceeded the configured fetch limit')
          const resolved = geocoder.decode(result.body.content)
          completedLookups++
          if (resolved !== undefined) {
            return this.patch({
              workspaceId: request.workspaceId,
              location: resolved.location,
              boundary: resolved.boundary ?? null,
            })
          }
        } catch (error) {
          failures.push(`${geocoder.name}: ${errorChain(error)}`)
        }
      }
    }
    if (completedLookups > 0) {
      throw new Error(`未找到局点“${request.query.trim()}”的地理位置，请输入包含城市或行政区的完整名称`)
    }
    if (failures.length > 0) {
      const diagnostics = [...new Set(failures)].join('；')
      throw new Error(
        `局点自动定位服务暂不可用（已尝试 Nominatim 与 Photon）：${diagnostics}`
        + '。请检查 DSH 启动环境的 HTTP_PROXY/HTTPS_PROXY、企业 CA 或外网策略后重试',
      )
    }
    throw new Error('局点自动定位未获得任何提供方响应')
  }

  /** Remove spatial assets before station membership deletion and return a durable rollback. */
  private removeStationAssets(workspaceId: WorkspaceId): Promise<GstarSiteDeletionPreparation> {
    this.deletingStations.add(workspaceId)
    const preparation = this.enqueueOperation(async () => {
      const stations = this.requireStations()
      const current = stations.get(workspaceId)
      try {
        if (current !== undefined) await stations.delete(workspaceId)
      } catch (cause) {
        this.deletingStations.delete(workspaceId)
        throw cause
      }
      return {
        commit: () => { this.deletingStations.delete(workspaceId) },
        rollback: async () => {
          try {
            if (current !== undefined) {
              await this.enqueueOperation(async () => { await stations.put(workspaceId, current) })
            }
          } finally {
            this.deletingStations.delete(workspaceId)
          }
        },
      }
    })
    return preparation.catch((cause) => {
      this.deletingStations.delete(workspaceId)
      throw cause
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
