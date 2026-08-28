/**
 * storage-domain Provider for GSTAR station spatial assets.
 * @module @deepseek-ai/dsh-gstar-spatial-storage
 */

import { createHash } from 'node:crypto'
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import GstarSpatialService from '@deepseek-ai/dsh-gstar-spatial'
import type {
  GstarAoiCategory, GstarAoiGeometry, GstarAoiSnapshot, GstarCoordinate,
  GstarDataSourceSnapshot, GstarEntityFieldValue, GstarLinearRing, GstarSpatialLocateRequest,
  GstarSpatialPatchRequest, GstarSpatialRefreshAoisRequest, GstarSpatialSnapshot,
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

/** Product AOI categories queried from OpenStreetMap and exposed by the map toolbar. */
const AOI_CATEGORIES: readonly GstarAoiCategory[] = [
  '政', '企', '金融', '教育', '医疗', '商场', '居民区',
]

const AOI_CATEGORY_SET: ReadonlySet<string> = new Set(AOI_CATEGORIES)

/** Provider configuration for bounded public OpenStreetMap acquisition. */
export interface Config {
  /** Overpass interpreter endpoint used for direct AOI acquisition. */
  overpassEndpoint?: string
  /** Overpass server-side query timeout in seconds. */
  overpassTimeoutSeconds?: number
  /** Maximum elements requested and published by one refresh. */
  overpassMaxElements?: number
  /** Search radius used when a station has a marker but no boundary. */
  fallbackRadiusMeters?: number
}

type ResolvedConfig = Required<Config>

interface OverpassResponse {
  readonly elements?: unknown
}

interface OverpassElement {
  readonly type?: unknown
  readonly id?: unknown
  readonly tags?: unknown
  readonly geometry?: unknown
  readonly members?: unknown
}

interface OverpassPosition {
  readonly lon?: unknown
  readonly lat?: unknown
}

interface OverpassMember {
  readonly type?: unknown
  readonly role?: unknown
  readonly geometry?: unknown
}

interface QueryBounds {
  readonly south: number
  readonly west: number
  readonly north: number
  readonly east: number
}

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
    throw new Error('GSTAR public data provider returned invalid JSON', { cause })
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
  for (const feature of value.features as unknown[]) {
    if (feature === null || typeof feature !== 'object'
      || (feature as PhotonFeature).geometry === null
      || typeof (feature as PhotonFeature).geometry !== 'object') continue
    const geometry = (feature as PhotonFeature).geometry as PhotonPoint
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

/** Build the public source catalog while keeping the configured acquisition endpoint visible. */
function sourceCatalog(overpassEndpoint: string): readonly GstarDataSourceSnapshot[] {
  return Object.freeze([
    Object.freeze({
      id: 'osm-overpass',
      name: 'OpenStreetMap / Overpass API',
      publisher: 'OpenStreetMap contributors',
      url: overpassEndpoint,
      categories: AOI_CATEGORIES,
      accessMode: 'direct' as const,
      license: 'ODbL-1.0',
    }),
    Object.freeze({
      id: 'national-public-data-registry',
      name: '国家公共数据资源登记平台',
      publisher: '国家数据局',
      url: 'https://sjdj.nda.gov.cn/',
      categories: AOI_CATEGORIES,
      accessMode: 'reference' as const,
    }),
    Object.freeze({
      id: 'national-government-service',
      name: '国家政务服务平台',
      publisher: '国务院办公厅',
      url: 'https://gjzwfw.www.gov.cn/index.html',
      categories: Object.freeze(['政', '企'] as const),
      accessMode: 'reference' as const,
    }),
    Object.freeze({
      id: 'national-enterprise-credit',
      name: '国家企业信用信息公示系统',
      publisher: '国家市场监督管理总局',
      url: 'https://www.gsxt.gov.cn/index.html',
      categories: Object.freeze(['企'] as const),
      accessMode: 'reference' as const,
    }),
    Object.freeze({
      id: 'national-financial-license',
      name: '金融许可证信息查询',
      publisher: '国家金融监督管理总局',
      url: 'https://xkz.nfra.gov.cn/',
      categories: Object.freeze(['金融'] as const),
      accessMode: 'reference' as const,
    }),
    Object.freeze({
      id: 'moe-higher-education-list',
      name: '全国普通高等学校名单',
      publisher: '中华人民共和国教育部',
      url: 'https://hudong.moe.gov.cn/qggxmd/',
      categories: Object.freeze(['教育'] as const),
      accessMode: 'reference' as const,
    }),
    Object.freeze({
      id: 'nhc-data-query',
      name: '国家卫生健康委员会数据查询',
      publisher: '国家卫生健康委员会',
      url: 'https://www.nhc.gov.cn/wjw/sjcx/sjcx.shtml',
      categories: Object.freeze(['医疗'] as const),
      accessMode: 'reference' as const,
    }),
  ])
}

/** Flatten every coordinate in a Polygon or MultiPolygon. */
function geometryCoordinates(value: GstarAoiGeometry): readonly GstarCoordinate[] {
  return value.type === 'Polygon'
    ? value.coordinates.flat()
    : value.coordinates.flat(2)
}

/** Resolve the smallest axis-aligned query box around a persisted station boundary. */
function boundaryBounds(value: GstarAoiGeometry): QueryBounds {
  const positions = geometryCoordinates(value)
  const longitudes = positions.map(position => position.longitude)
  const latitudes = positions.map(position => position.latitude)
  return {
    south: Math.min(...latitudes),
    west: Math.min(...longitudes),
    north: Math.max(...latitudes),
    east: Math.max(...longitudes),
  }
}

/** Resolve a bounded marker search when the geocoder supplied no station polygon. */
function markerBounds(value: GstarCoordinate, radiusMeters: number): QueryBounds {
  const latitudeDelta = radiusMeters / 111_320
  const longitudeDelta = radiusMeters / (111_320 * Math.max(Math.cos(value.latitude * Math.PI / 180), 0.01))
  return {
    south: Math.max(-90, value.latitude - latitudeDelta),
    west: Math.max(-180, value.longitude - longitudeDelta),
    north: Math.min(90, value.latitude + latitudeDelta),
    east: Math.min(180, value.longitude + longitudeDelta),
  }
}

/** Construct one bounded Overpass query for the seven GSTAR AOI categories. */
function overpassUrl(bounds: QueryBounds, config: ResolvedConfig): URL {
  const box = `${String(bounds.south)},${String(bounds.west)},${String(bounds.north)},${String(bounds.east)}`
  const query = [
    `[out:json][timeout:${String(config.overpassTimeoutSeconds)}];`,
    '(',
    `wr["amenity"~"^(townhall|bank|school|college|university|kindergarten|hospital|clinic|doctors|pharmacy|marketplace)$"](${box});`,
    `wr["office"~"^(government|company|financial|insurance)$"](${box});`,
    `wr["shop"~"^(mall|department_store)$"](${box});`,
    `wr["landuse"~"^(industrial|commercial|residential)$"](${box});`,
    `wr["building"~"^(government|office|commercial|industrial|school|college|university|kindergarten|hospital|clinic|retail|apartments|residential|dormitory)$"](${box});`,
    `wr["government"](${box});`,
    `wr["residential"](${box});`,
    ');',
    `out tags geom qt ${String(config.overpassMaxElements)};`,
  ].join('')
  const url = new URL(config.overpassEndpoint)
  url.searchParams.set('data', query)
  return url
}

/** Keep only string-valued OSM tags at the untyped JSON boundary. */
function overpassTags(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return Object.fromEntries(entries)
}

/** Classify one OSM feature into the stable toolbar taxonomy. */
function aoiCategory(tags: Readonly<Record<string, string>>): GstarAoiCategory | undefined {
  if (['hospital', 'clinic', 'doctors', 'pharmacy'].includes(tags.amenity ?? '')
    || ['hospital', 'clinic'].includes(tags.building ?? '')) return '医疗'
  if (['school', 'college', 'university', 'kindergarten'].includes(tags.amenity ?? '')
    || ['school', 'college', 'university', 'kindergarten'].includes(tags.building ?? '')) return '教育'
  if (tags.amenity === 'bank' || ['financial', 'insurance'].includes(tags.office ?? '')) return '金融'
  if (tags.amenity === 'townhall' || tags.office === 'government'
    || tags.government !== undefined || tags.building === 'government') return '政'
  if (['mall', 'department_store'].includes(tags.shop ?? '') || tags.amenity === 'marketplace'
    || tags.building === 'retail') return '商场'
  if (tags.landuse === 'residential' || tags.residential !== undefined
    || ['apartments', 'residential', 'dormitory'].includes(tags.building ?? '')) return '居民区'
  if (tags.office === 'company' || ['industrial', 'commercial'].includes(tags.landuse ?? '')
    || ['office', 'commercial', 'industrial'].includes(tags.building ?? '')) return '企'
  return undefined
}

/** Decode an Overpass geometry array into WGS84 coordinates. */
function overpassPositions(value: unknown): GstarCoordinate[] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined
  const result: GstarCoordinate[] = []
  for (const candidate of value as unknown[]) {
    if (candidate === null || typeof candidate !== 'object') return undefined
    const position = coordinate((candidate as OverpassPosition).lon, (candidate as OverpassPosition).lat)
    if (position === undefined) return undefined
    const previous = result.at(-1)
    if (previous?.longitude !== position.longitude || previous.latitude !== position.latitude) result.push(position)
  }
  return result.length < 2 ? undefined : result
}

/** Compare OSM node coordinates exactly; member fragments reuse the same numeric node values. */
function equalPosition(left: GstarCoordinate, right: GstarCoordinate): boolean {
  return left.longitude === right.longitude && left.latitude === right.latitude
}

/** Join relation member fragments into every closed ring available in the response. */
function joinedRings(fragments: readonly GstarCoordinate[][]): readonly GstarLinearRing[] {
  const pending = fragments.map(fragment => [...fragment])
  const rings: GstarLinearRing[] = []
  while (pending.length > 0) {
    const ring = pending.shift()
    /* v8 ignore next -- pending.length is positive immediately before this shift. */
    if (ring === undefined) break
    while (ring.length >= 2) {
      const start = ring[0]
      const end = ring.at(-1)
      if (start === undefined || end === undefined || equalPosition(start, end)) break
      const index = pending.findIndex((fragment) => {
        const fragmentStart = fragment[0]
        const fragmentEnd = fragment.at(-1)
        return fragmentStart !== undefined && fragmentEnd !== undefined
          && (equalPosition(end, fragmentStart) || equalPosition(end, fragmentEnd)
            || equalPosition(start, fragmentEnd) || equalPosition(start, fragmentStart))
      })
      if (index < 0) break
      const fragment = pending.splice(index, 1)[0]
      const fragmentStart = fragment?.[0]
      const fragmentEnd = fragment?.at(-1)
      /* v8 ignore next -- findIndex returned an in-range fragment whose decoder guarantees two positions. */
      if (fragment === undefined || fragmentStart === undefined || fragmentEnd === undefined) break
      if (equalPosition(end, fragmentStart)) ring.push(...fragment.slice(1))
      else if (equalPosition(end, fragmentEnd)) ring.push(...fragment.reverse().slice(1))
      else if (equalPosition(start, fragmentEnd)) ring.unshift(...fragment.slice(0, -1))
      else ring.unshift(...fragment.reverse().slice(0, -1))
    }
    const first = ring[0]
    const last = ring.at(-1)
    if (ring.length >= 4 && first !== undefined && last !== undefined && equalPosition(first, last)) rings.push(ring)
  }
  return rings
}

/** Test whether one coordinate lies inside an outer ring for assigning relation holes. */
function pointInRing(point: GstarCoordinate, ring: GstarLinearRing): boolean {
  let inside = false
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const a = ring[current]
    const b = ring[previous]
    /* v8 ignore next -- joinedRings publishes only non-empty closed rings and both indices are loop-bounded. */
    if (a === undefined || b === undefined) return false
    const intersects = (a.latitude > point.latitude) !== (b.latitude > point.latitude)
      && point.longitude < (b.longitude - a.longitude) * (point.latitude - a.latitude)
        / (b.latitude - a.latitude) + a.longitude
    if (intersects) inside = !inside
  }
  return inside
}

/** Decode a closed way or multipolygon relation into GSTAR AOI geometry. */
function overpassGeometry(element: OverpassElement): GstarAoiGeometry | undefined {
  if (element.type === 'way') {
    const positions = overpassPositions(element.geometry)
    const first = positions?.[0]
    const last = positions?.at(-1)
    if (positions === undefined || positions.length < 4 || first === undefined || last === undefined
      || !equalPosition(first, last)) {
      return undefined
    }
    return { type: 'Polygon', coordinates: [positions] }
  }
  if (element.type !== 'relation' || !Array.isArray(element.members)) return undefined
  const outerFragments: GstarCoordinate[][] = []
  const innerFragments: GstarCoordinate[][] = []
  for (const member of element.members as unknown[]) {
    if (member === null || typeof member !== 'object' || (member as OverpassMember).type !== 'way') continue
    const typedMember = member as OverpassMember
    const positions = overpassPositions(typedMember.geometry)
    if (positions === undefined) continue
    if (typedMember.role === 'inner') innerFragments.push(positions)
    else if (typedMember.role === 'outer' || typedMember.role === '') outerFragments.push(positions)
  }
  const outers = joinedRings(outerFragments)
  if (outers.length === 0) return undefined
  const polygons = outers.map(outer => [outer] as GstarLinearRing[])
  for (const inner of joinedRings(innerFragments)) {
    const point = inner[0]
    /* v8 ignore next -- joinedRings publishes only rings with at least four coordinates. */
    if (point === undefined) continue
    const owner = polygons.find((polygon) => {
      const outer = polygon[0]
      /* v8 ignore next -- every polygon is constructed above from exactly one outer ring. */
      return outer !== undefined && pointInRing(point, outer)
    })
    owner?.push(inner)
  }
  const onlyPolygon = polygons[0]
  return polygons.length === 1 && onlyPolygon !== undefined
    ? { type: 'Polygon', coordinates: onlyPolygon }
    : { type: 'MultiPolygon', coordinates: polygons }
}

const ENTITY_TAG_FIELDS = [
  'name', 'name:zh', 'amenity', 'office', 'government', 'shop', 'landuse', 'building', 'residential',
  'operator', 'brand', 'addr:full', 'addr:street', 'addr:housenumber', 'phone', 'website', 'opening_hours',
] as const

/** Publish a concise normalized entity record instead of leaking an unbounded raw tag bag. */
function entityFields(
  elementType: 'way' | 'relation', id: number, category: GstarAoiCategory,
  tags: Readonly<Record<string, string>>,
): Readonly<Record<string, GstarEntityFieldValue>> {
  const fields: Record<string, GstarEntityFieldValue> = {
    osm_type: elementType,
    osm_id: id,
    aoi_category: category,
  }
  for (const name of ENTITY_TAG_FIELDS) {
    const value = tags[name]
    if (value !== undefined) fields[name] = value
  }
  return fields
}

const ENTITY_TYPES: Readonly<Record<GstarAoiCategory, string>> = {
  '政': 'government_facility',
  '企': 'enterprise_site',
  '金融': 'financial_institution',
  '教育': 'education_facility',
  '医疗': 'medical_facility',
  '商场': 'shopping_facility',
  '居民区': 'residential_area',
}

/** Decode a bounded Overpass JSON response into durable AOIs with per-feature provenance. */
function decodeOverpass(content: string, retrievedAt: string, maxElements: number): readonly GstarAoiSnapshot[] {
  const value = decodeJson(content) as OverpassResponse | null
  if (value === null || typeof value !== 'object' || !Array.isArray(value.elements)) {
    throw new Error('GSTAR Overpass returned a payload without an elements array')
  }
  const aois: GstarAoiSnapshot[] = []
  for (const candidate of value.elements as unknown[]) {
    if (candidate === null || typeof candidate !== 'object'
      || ((candidate as OverpassElement).type !== 'way' && (candidate as OverpassElement).type !== 'relation')
      || typeof (candidate as OverpassElement).id !== 'number'
      || !Number.isSafeInteger((candidate as OverpassElement).id)) continue
    const element = candidate as OverpassElement & { readonly id: number; readonly type: 'way' | 'relation' }
    const tags = overpassTags(element.tags)
    if (tags === undefined) continue
    const category = aoiCategory(tags)
    const aoiGeometry = category === undefined ? undefined : overpassGeometry(element)
    if (category === undefined || aoiGeometry === undefined) continue
    const osmType = element.type
    const osmId = element.id
    const objectUrl = `https://www.openstreetmap.org/${osmType}/${String(osmId)}`
    const stableId = `osm-${osmType}-${String(osmId)}`
    const name = tags['name:zh'] ?? tags.name ?? tags.brand ?? tags.operator ?? `${category} AOI ${String(osmId)}`
    aois.push({
      id: stableId,
      name,
      category,
      geometry: aoiGeometry,
      entities: [{
        id: stableId,
        type: ENTITY_TYPES[category],
        fields: entityFields(osmType, osmId, category, tags),
      }],
      provenance: [{
        sourceId: 'osm-overpass',
        sourceName: 'OpenStreetMap / Overpass API',
        sourceUrl: objectUrl,
        retrievedAt,
        license: 'ODbL-1.0',
        checksum: `sha256:${createHash('sha256').update(JSON.stringify(element)).digest('hex')}`,
      }],
      updatedAt: retrievedAt,
    })
    if (aois.length >= maxElements) break
  }
  return aois
}

/** Render the actionable portion of a fetch cause chain across the Remote boundary. */
function errorChain(value: unknown): string {
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current: unknown = value
  while (current !== undefined && current !== null && !seen.has(current) && messages.length < 4) {
    seen.add(current)
    const message = current instanceof Error
      ? current.message
      : typeof current === 'string' ? current : JSON.stringify(current)
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

/** Narrow a durable v0 category without guessing how an obsolete taxonomy should map. */
function publicAoiCategory(value: string): GstarAoiCategory | undefined {
  return AOI_CATEGORY_SET.has(value) ? value as GstarAoiCategory : undefined
}

/** Convert a compatible durable AOI record into the public readonly projection. */
function aoiSnapshot(record: GstarAoiRecord): GstarAoiSnapshot | undefined {
  const category = publicAoiCategory(record.category)
  return category === undefined ? undefined : { ...copyAoi(record), category }
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
    aois: Object.freeze((record?.aois ?? [])
      .map(aoiSnapshot)
      .filter((aoi): aoi is GstarAoiSnapshot => aoi !== undefined)),
    ...(record === undefined ? {} : { updatedAt: record.updatedAt }),
  })
}

/** Durable spatial provider restricted to Workspaces classified as GSTAR stations. */
export class StorageGstarSpatialService extends GstarSpatialService {
  static inject = ['storageDomain', 'gstarSites', 'web']

  static Config: z<Config> = z.object({
    overpassEndpoint: z.string().default('https://overpass-api.de/api/interpreter'),
    overpassTimeoutSeconds: z.natural().min(1).max(300).default(120),
    overpassMaxElements: z.natural().min(1).max(10_000).default(2_000),
    fallbackRadiusMeters: z.number().min(100).max(100_000).default(15_000),
  })

  private stations: KvTable<WorkspaceId, GstarSpatialRecord> | undefined
  private readonly deletingStations = new Set<WorkspaceId>()
  private operationTail: Promise<void> = Promise.resolve()
  private operationAdmissionOpen = true
  private readonly config: ResolvedConfig

  /**
   * @param ctx - Host context carrying storage, station, and Web capabilities.
   * @param config - Validated OpenStreetMap acquisition limits and endpoint.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.config = config as ResolvedConfig
    const endpoint = new URL(this.config.overpassEndpoint)
    if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
      throw new Error('gstar-spatial-storage: overpassEndpoint must use http or https')
    }
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

  override listSources(): Promise<readonly GstarDataSourceSnapshot[]> {
    return Promise.resolve(sourceCatalog(this.config.overpassEndpoint))
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
            return await this.patch({
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
    /* v8 ignore else -- a non-empty static GEOCODERS list makes the zero-failure fallthrough unreachable. */
    if (failures.length > 0) {
      const diagnostics = [...new Set(failures)].join('；')
      throw new Error(
        `局点自动定位服务暂不可用（已尝试 Nominatim 与 Photon）：${diagnostics}`
        + '。请检查 DSH 启动环境的 HTTP_PROXY/HTTPS_PROXY、企业 CA 或外网策略后重试',
      )
    }
    /* v8 ignore next -- retained as a fail-loud guard if the static provider list ever becomes empty. */
    throw new Error('局点自动定位未获得任何提供方响应')
  }

  override async refreshAois(request: GstarSpatialRefreshAoisRequest): Promise<GstarSpatialSnapshot> {
    const sites = await this.ctx.gstarSites.list()
    if (!sites.some(site => site.workspaceId === request.workspaceId)) {
      throw new Error(`gstarSpatial.refreshAois: Workspace ${request.workspaceId} is not a GSTAR station`)
    }
    const current = this.requireStations().get(request.workspaceId)
    const bounds = current?.boundary === undefined
      ? current?.location === undefined
        ? undefined
        : markerBounds(copyCoordinate(current.location), this.config.fallbackRadiusMeters)
      : boundaryBounds(copyGeometry(current.boundary))
    if (bounds === undefined) {
      throw new Error('请先完成局点自动定位，再从 OpenStreetMap 获取 AOI')
    }
    const url = overpassUrl(bounds, this.config)
    let result
    try {
      result = await this.ctx.web.fetch({ url: url.href })
    } catch (cause) {
      throw new Error(`OpenStreetMap AOI 获取失败：${errorChain(cause)}`, { cause })
    }
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`OpenStreetMap AOI 获取失败：Overpass HTTP ${String(result.statusCode)}`)
    }
    if (result.truncated) {
      throw new Error('OpenStreetMap AOI 获取失败：Overpass 响应超过 DSH Web 获取上限')
    }
    const retrievedAt = new Date().toISOString()
    const aois = decodeOverpass(result.body.content, retrievedAt, this.config.overpassMaxElements)
    return this.patch({ workspaceId: request.workspaceId, aois })
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
    return preparation.catch((cause: unknown) => {
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
