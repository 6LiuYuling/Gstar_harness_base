/**
 * Durable GSTAR spatial catalog schema.
 * @module @deepseek-ai/dsh-gstar-spatial-storage/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

/** WGS84 coordinate persisted by the spatial provider. */
export const gstarCoordinateRecord = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  height: z.number().optional(),
})

/** A closed linear ring with at least four positions. */
export const gstarLinearRingRecord = z.array(gstarCoordinateRecord).min(4).superRefine((ring, ctx) => {
  const first = ring[0]
  const last = ring.at(-1)
  if (first?.longitude === last?.longitude && first?.latitude === last?.latitude
    && first?.height === last?.height) return
  ctx.addIssue({ code: 'custom', message: 'linear ring must end at its first coordinate' })
})

/** Polygon or multi-polygon geometry persisted for an AOI. */
export const gstarAoiGeometryRecord = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(gstarLinearRingRecord).min(1) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(gstarLinearRingRecord).min(1)).min(1),
  }),
])

const gstarEntityFieldValueRecord = z.union([z.string(), z.number(), z.boolean(), z.null()])

/** Entity fields carried with one AOI. */
export const gstarEntityRecord = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  fields: z.record(z.string(), gstarEntityFieldValueRecord),
})

/** Acquisition provenance carried with one AOI. */
export const gstarProvenanceRecord = z.object({
  sourceId: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.url().optional(),
  retrievedAt: z.iso.datetime(),
  license: z.string().min(1).optional(),
  checksum: z.string().min(1).optional(),
})

/** One durable AOI publication. */
export const gstarAoiRecord = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  geometry: gstarAoiGeometryRecord,
  entities: z.array(gstarEntityRecord),
  provenance: z.array(gstarProvenanceRecord),
  updatedAt: z.iso.datetime(),
})

/** Complete durable spatial record for one station. */
export const gstarSpatialRecord = z.object({
  location: gstarCoordinateRecord.optional(),
  aois: z.array(gstarAoiRecord),
  updatedAt: z.iso.datetime(),
})

/** Persisted record inferred from the durable schema. */
export type GstarSpatialRecord = z.infer<typeof gstarSpatialRecord>

/** GSTAR spatial catalog keyed by classified station Workspace identity. */
export const gstarSpatialDomainSpec = defineDomain({
  name: 'gstar_spatial',
  version: 0,
  tables: {
    stations: domainTable<WorkspaceId, GstarSpatialRecord>(gstarSpatialRecord),
  },
})
