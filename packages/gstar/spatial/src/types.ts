/**
 * Browser-safe GSTAR spatial asset vocabulary.
 * @module @deepseek-ai/dsh-gstar-spatial/types
 */

import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** Geographic coordinate on the WGS84 ellipsoid. */
export interface GstarCoordinate {
  /** Longitude in decimal degrees, within [-180, 180]. */
  readonly longitude: number
  /** Latitude in decimal degrees, within [-90, 90]. */
  readonly latitude: number
  /** Optional ellipsoid height in meters. */
  readonly height?: number
}

/** One linear ring; the first and last positions are equal. */
export type GstarLinearRing = readonly GstarCoordinate[]

/** Polygon geometry with one outer ring followed by optional holes. */
export interface GstarPolygonGeometry {
  readonly type: 'Polygon'
  readonly coordinates: readonly GstarLinearRing[]
}

/** Multi-polygon geometry with Polygon coordinate nesting. */
export interface GstarMultiPolygonGeometry {
  readonly type: 'MultiPolygon'
  readonly coordinates: readonly (readonly GstarLinearRing[])[]
}

/** AOI geometry accepted by the GSTAR globe. */
export type GstarAoiGeometry = GstarPolygonGeometry | GstarMultiPolygonGeometry

/** Scalar value that may cross the Host/Client Remote and render in an entity field table. */
export type GstarEntityFieldValue = string | number | boolean | null

/** One entity contained by an AOI. */
export interface GstarEntitySnapshot {
  /** Stable identity within the station's spatial catalog. */
  readonly id: string
  /** Domain entity type, such as road, building, facility, or parcel. */
  readonly type: string
  /** Source-normalized entity fields. */
  readonly fields: Readonly<Record<string, GstarEntityFieldValue>>
}

/** One source record explaining where an AOI or its entities came from. */
export interface GstarProvenanceSnapshot {
  /** Stable source plugin or dataset identity. */
  readonly sourceId: string
  /** Human-readable source or dataset name. */
  readonly sourceName: string
  /** Source URL when the provider can publish one. */
  readonly sourceUrl?: string
  /** Retrieval instant in ISO-8601 form. */
  readonly retrievedAt: string
  /** License identifier or short license name when known. */
  readonly license?: string
  /** Content checksum when the acquisition pipeline recorded one. */
  readonly checksum?: string
}

/** One typed area of interest published by a station data pipeline. */
export interface GstarAoiSnapshot {
  /** Stable AOI identity within the station. */
  readonly id: string
  /** Human-readable AOI name. */
  readonly name: string
  /** Product category used for map styling and filtering. */
  readonly category: string
  /** WGS84 polygon or multi-polygon geometry. */
  readonly geometry: GstarAoiGeometry
  /** Entities currently associated with the AOI. */
  readonly entities: readonly GstarEntitySnapshot[]
  /** Acquisition records for the AOI and its entities. */
  readonly provenance: readonly GstarProvenanceSnapshot[]
  /** Successful pipeline publication instant in ISO-8601 form. */
  readonly updatedAt: string
}

/** Complete spatial projection for one GSTAR station Workspace. */
export interface GstarSpatialSnapshot {
  /** Owning station Workspace identity. */
  readonly workspaceId: WorkspaceId
  /** Station marker location; absent until a real location is committed. */
  readonly location?: GstarCoordinate
  /** AOIs published for the station. */
  readonly aois: readonly GstarAoiSnapshot[]
  /** Most recent spatial record mutation, or undefined before the first mutation. */
  readonly updatedAt?: string
}

/** Patch the durable spatial record without replacing fields omitted by the caller. */
export interface GstarSpatialPatchRequest {
  /** Owning station Workspace identity. */
  readonly workspaceId: WorkspaceId
  /** New marker location when the caller is committing station placement. */
  readonly location?: GstarCoordinate
  /** Complete AOI replacement when a processing pipeline publishes a data version. */
  readonly aois?: readonly GstarAoiSnapshot[]
}
