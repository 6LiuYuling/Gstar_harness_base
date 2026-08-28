import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { apply, inject, MAX_ENTITY_LIMIT, queryStationData } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

const SITE = {
  workspaceId: WorkspaceId('site-1'),
  path: '/stations/guangzhou',
  title: '广州局点',
  sessionCount: 1,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
}
const AOI = {
  id: 'aoi-1',
  name: '广州道路',
  category: '政',
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[
      { longitude: 113, latitude: 23 },
      { longitude: 114, latitude: 23 },
      { longitude: 114, latitude: 24 },
      { longitude: 113, latitude: 23 },
    ]],
  },
  entities: [
    { id: 'road-1', type: 'road', fields: { name: '体育西路' } },
    { id: 'road-2', type: 'road', fields: { name: '天河路' } },
  ],
  provenance: [{
    sourceId: 'osm', sourceName: 'OpenStreetMap', retrievedAt: '2026-08-21T08:00:00.000Z',
  }],
  updatedAt: '2026-08-21T08:00:00.000Z',
}

function agent(cwd?: string): Agent {
  return { session: { header: { cwd } } } as never
}

function context() {
  const ctx = new Context()
  ctx.provide('gstarSites', { list: async () => [SITE] } as never)
  ctx.provide('gstarSpatial', { list: async () => [{
    workspaceId: SITE.workspaceId,
    location: { longitude: 113.3, latitude: 23.1 },
    aois: [AOI],
    updatedAt: '2026-08-21T08:00:00.000Z',
  }] } as never)
  return ctx
}

describe('gstar_station_data', () => {
  it('returns a current-station overview without leaking full entity arrays', async () => {
    const value = JSON.parse(await queryStationData(context(), {}, agent(SITE.path))) as {
      station: { title: string }
      spatial: { aois: Array<{ entityCount: number; entities?: unknown }> }
    }
    expect(value.station.title).toBe(SITE.title)
    expect(value.spatial.aois[0]).toMatchObject({ id: AOI.id, entityCount: 2 })
    expect(value.spatial.aois[0]?.entities).toBeUndefined()
  })

  it('returns bounded entity fields and provenance for one AOI', async () => {
    const value = JSON.parse(await queryStationData(
      context(), { aoi_id: AOI.id, entity_limit: 1 }, agent(SITE.path),
    )) as { aoi: { entities: unknown[]; entityCount: number; entitiesTruncated: boolean; provenance: unknown[] } }
    expect(value.aoi.entities).toHaveLength(1)
    expect(value.aoi.entityCount).toBe(2)
    expect(value.aoi.entitiesTruncated).toBe(true)
    expect(value.aoi.provenance).toHaveLength(1)
  })

  it('rejects missing station authority, unknown AOIs, and invalid limits', async () => {
    await expect(queryStationData(context(), {}, undefined)).rejects.toThrow('requires a calling station Session')
    await expect(queryStationData(context(), {}, agent('/ordinary'))).rejects.toThrow('is not a GSTAR station')
    await expect(queryStationData(context(), { aoi_id: 'missing' }, agent(SITE.path)))
      .rejects.toThrow('does not exist')
    await expect(queryStationData(
      context(), { aoi_id: AOI.id, entity_limit: MAX_ENTITY_LIMIT + 1 }, agent(SITE.path),
    )).rejects.toThrow('entity_limit must be an integer')
  })

  it('registers one concurrency-safe DSH tool', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = context()
    ctx.provide('tools', { register } as never)
    expect(inject).toEqual(['tools', 'gstarSites', 'gstarSpatial'])
    await ctx.plugin({ inject: [...inject], apply }).await()
    const definition = register.mock.calls[0]![0] as {
      name: string
      isConcurrencySafe(args: unknown): boolean
      execute(args: unknown, exec: { agent: Agent }): Promise<string>
      output: { render(args: unknown, value: string): Array<{ text: string }> }
    }
    expect(definition.name).toBe('gstar_station_data')
    expect(definition.isConcurrencySafe({})).toBe(true)
    const value = await definition.execute({}, { agent: agent(SITE.path) })
    expect(definition.output.render({}, value)[0]?.text).toBe(value)
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-tool-spatial-query', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (value: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
