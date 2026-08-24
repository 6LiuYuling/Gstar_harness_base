/** Model-facing, current-station spatial-data query Consumer. */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-gstar-site'
import type {} from '@deepseek-ai/dsh-gstar-spatial'
import type { GstarAoiSnapshot, GstarSpatialSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis plugin name. */
export const name = 'gstar-tool-spatial-query'
/** Capability services required by the model-facing Consumer. */
export const inject = ['tools', 'gstarSites', 'gstarSpatial']

/** Default and maximum entities returned for one AOI query. */
export const DEFAULT_ENTITY_LIMIT = 50
export const MAX_ENTITY_LIMIT = 200

/** Arguments accepted by the station-data tool. */
export interface GstarStationDataArgs {
  readonly aoi_id?: string
  readonly entity_limit?: number
}

/** Resolve the current station from the immutable calling Session cwd. */
async function currentStation(ctx: Context, agent?: Agent) {
  const cwd = agent?.session.header.cwd
  if (cwd === undefined) throw new Error('gstar_station_data requires a calling station Session with a cwd')
  const station = (await ctx.gstarSites.list()).find(candidate => candidate.path === cwd)
  if (station === undefined) {
    throw new Error(`gstar_station_data: Session cwd ${JSON.stringify(cwd)} is not a GSTAR station`)
  }
  return station
}

/** Validate the bounded entity count controlled by the caller. */
function entityLimit(value?: number): number {
  const limit = value ?? DEFAULT_ENTITY_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ENTITY_LIMIT) {
    throw new Error(`gstar_station_data: entity_limit must be an integer from 1 to ${String(MAX_ENTITY_LIMIT)}`)
  }
  return limit
}

/** Compact AOI projection used for station-overview calls. */
function aoiSummary(aoi: GstarAoiSnapshot) {
  return {
    id: aoi.id,
    name: aoi.name,
    category: aoi.category,
    entityCount: aoi.entities.length,
    provenance: aoi.provenance,
    updatedAt: aoi.updatedAt,
  }
}

/** Query current-station Host data for the tool execute path and focused tests. */
export async function queryStationData(
  ctx: Context,
  args: GstarStationDataArgs,
  agent?: Agent,
): Promise<string> {
  const station = await currentStation(ctx, agent)
  const emptySpatial: GstarSpatialSnapshot = { workspaceId: station.workspaceId, aois: [] }
  const spatial = (await ctx.gstarSpatial.list()).find(item => item.workspaceId === station.workspaceId)
    ?? emptySpatial
  if (args.aoi_id === undefined) {
    return JSON.stringify({
      station,
      spatial: {
        ...(spatial.location === undefined ? {} : { location: spatial.location }),
        aois: spatial.aois.map(aoiSummary),
        ...(spatial.updatedAt === undefined ? {} : { updatedAt: spatial.updatedAt }),
      },
    }, null, 2)
  }
  const aoi = spatial.aois.find(candidate => candidate.id === args.aoi_id)
  if (aoi === undefined) {
    throw new Error(`gstar_station_data: AOI ${JSON.stringify(args.aoi_id)} does not exist in station ${station.title}`)
  }
  const limit = entityLimit(args.entity_limit)
  return JSON.stringify({
    station: { workspaceId: station.workspaceId, path: station.path, title: station.title },
    aoi: {
      ...aoi,
      entities: aoi.entities.slice(0, limit),
      entityCount: aoi.entities.length,
      entitiesTruncated: aoi.entities.length > limit,
    },
  }, null, 2)
}

/** Register the read-only current-station data tool. */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'gstar_station_data',
    description: 'Read the current GSTAR station, its AOIs, entity fields, and acquisition provenance. Omit aoi_id for an overview; provide it for entity-level data.',
    parameters: {
      aoi_id: { type: 'string', description: 'AOI id from a station overview. Omit to list AOIs.' },
      entity_limit: {
        type: 'integer',
        description: `Maximum entities returned for one AOI, from 1 to ${String(MAX_ENTITY_LIMIT)}.`,
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    execute: (args, exec) => queryStationData(ctx, args, exec.agent),
  }))
}
