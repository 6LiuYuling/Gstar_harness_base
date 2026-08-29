import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { GstarSiteDeletionParticipant } from '@deepseek-ai/dsh-gstar-site'
import type { GstarAoiSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId as WorkspaceIdType } from '@deepseek-ai/dsh-workspace/types'
import StorageGstarSpatialService, {
  gstarAoiRecord, gstarSpatialDomainSpec, type GstarSpatialRecord,
} from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

const SITE_ID = WorkspaceId('site-1')
const ORDINARY_ID = WorkspaceId('workspace-1')
const SITE = {
  workspaceId: SITE_ID,
  path: '/stations/guangzhou',
  title: '广州局点',
  sessionCount: 0,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
}

interface FetchResult {
  readonly url: string
  readonly statusCode: number
  readonly body: { readonly kind: 'text'; readonly content: string }
  readonly truncated: boolean
}

function response(content: string, statusCode = 200, truncated = false): FetchResult {
  return { url: 'https://public-data.example.test/', statusCode, body: { kind: 'text', content }, truncated }
}

describe('gstar-spatial-storage through a real Loader composition', () => {
  it('persists only classified station spatial data and retains omitted fields', async () => {
    const records = new Map<WorkspaceIdType, GstarSpatialRecord>()
    const put = vi.fn(async (id: WorkspaceIdType, value: GstarSpatialRecord) => { records.set(id, value) })
    const remove = vi.fn(async (id: WorkspaceIdType) => { records.delete(id) })
    const close = vi.fn(async () => {})
    let deletionParticipant: GstarSiteDeletionParticipant | undefined
    const removeParticipant = vi.fn()

    root = await mkdtemp(join(tmpdir(), 'dsh-gstar-spatial-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-gstar-spatial-storage'",
      '  config:',
      '    overpassMaxElements: 7',
      '',
    ].join('\n'))

    context = new Context()
    context.provide('gstarSites', {
      list: async () => [SITE],
      registerDeletionParticipant: vi.fn((participant: GstarSiteDeletionParticipant) => {
        deletionParticipant = participant
        return removeParticipant
      }),
    } as never)
    context.provide('storageDomain', {
      open: vi.fn(async () => ({
        table: () => ({ get: (id: WorkspaceIdType) => records.get(id), put, delete: remove }),
        close,
      })),
    } as never)
    const fetch = vi.fn<(request: { readonly url: string }) => Promise<FetchResult>>()
      .mockResolvedValueOnce({
        url: 'https://nominatim.openstreetmap.org/search', statusCode: 200,
        body: {
          kind: 'text',
          content: JSON.stringify([{
            lat: '23.1291',
            lon: '113.2644',
            boundingbox: ['22.9', '23.4', '112.9', '113.8'],
            geojson: {
              type: 'Polygon',
              coordinates: [[
                [113, 23], [114, 23], [114, 24], [113, 23],
              ], [
                [113.4, 23.05], [113.5, 23.05], [113.5, 23.1], [113.4, 23.05],
              ]],
            },
          }]),
        },
        truncated: false,
      })
    context.provide('web', { fetch } as never)
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (specifier === '@deepseek-ai/dsh-gstar-spatial-storage') return StorageGstarSpatialService
        throw new Error(`unexpected Loader import: ${specifier}`)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    const legacyRecord: GstarSpatialRecord = {
      aois: [{
        id: 'legacy-road',
        name: '旧版道路 AOI',
        category: '道路',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            { longitude: 113, latitude: 23 },
            { longitude: 114, latitude: 23 },
            { longitude: 114, latitude: 24 },
            { longitude: 113, latitude: 23 },
          ]],
        },
        entities: [],
        provenance: [],
        updatedAt: '2026-08-20T08:00:00.000Z',
      }],
      updatedAt: '2026-08-20T08:00:00.000Z',
    }
    expect(gstarSpatialDomainSpec.version).toBe(0)
    expect(gstarAoiRecord.safeParse(legacyRecord.aois[0]).success).toBe(true)
    records.set(SITE_ID, legacyRecord)
    await expect(context.gstarSpatial.list()).resolves.toEqual([{
      workspaceId: SITE_ID,
      aois: [],
      updatedAt: '2026-08-20T08:00:00.000Z',
    }])
    expect(records.get(SITE_ID)).toBe(legacyRecord)
    records.delete(SITE_ID)

    await expect(context.gstarSpatial.list()).resolves.toEqual([{ workspaceId: SITE_ID, aois: [] }])
    await expect(context.gstarSpatial.patch({
      workspaceId: SITE_ID,
      location: { longitude: 113.3, latitude: 23.1 },
    })).resolves.toMatchObject({
      workspaceId: SITE_ID,
      location: { longitude: 113.3, latitude: 23.1 },
      aois: [],
    })

    const aoi: GstarAoiSnapshot = {
      id: 'aoi-1',
      name: '广州道路',
      category: '政',
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          { longitude: 113, latitude: 23, height: 5 },
          { longitude: 114, latitude: 23 },
          { longitude: 114, latitude: 24 },
          { longitude: 113, latitude: 23 },
        ]],
      },
      entities: [],
      provenance: [{
        sourceId: 'manual-test',
        sourceName: 'Manual test source',
        retrievedAt: '2026-08-21T08:00:00.000Z',
      }],
      updatedAt: '2026-08-21T08:00:00.000Z',
    }
    await expect(context.gstarSpatial.patch({ workspaceId: SITE_ID, aois: [aoi] }))
      .resolves.toMatchObject({
        workspaceId: SITE_ID,
        location: { longitude: 113.3, latitude: 23.1 },
        aois: [aoi],
      })
    expect(put).toHaveBeenCalledTimes(2)

    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州局点' }))
      .resolves.toMatchObject({
        workspaceId: SITE_ID,
        location: { longitude: 113.2644, latitude: 23.1291 },
        boundary: {
          type: 'Polygon',
          coordinates: [[
            { longitude: 113, latitude: 23 },
            { longitude: 114, latitude: 23 },
            { longitude: 114, latitude: 24 },
            { longitude: 113, latitude: 23 },
          ], [
            { longitude: 113.4, latitude: 23.05 },
            { longitude: 113.5, latitude: 23.05 },
            { longitude: 113.5, latitude: 23.1 },
            { longitude: 113.4, latitude: 23.05 },
          ]],
        },
        aois: [aoi],
      })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(new URL(fetch.mock.calls[0]![0].url).searchParams.get('q')).toBe('广州')
    expect(new URL(fetch.mock.calls[0]![0].url).searchParams.get('polygon_geojson')).toBe('1')
    expect(put).toHaveBeenCalledTimes(3)

    await expect(context.gstarSpatial.listSources()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'osm-overpass', accessMode: 'direct' }),
      expect.objectContaining({ id: 'national-enterprise-credit', accessMode: 'reference' }),
      expect.objectContaining({ id: 'national-financial-license', categories: ['金融'] }),
      expect.objectContaining({ id: 'moe-higher-education-list', categories: ['教育'] }),
      expect.objectContaining({ id: 'nhc-data-query', categories: ['医疗'] }),
    ]))
    fetch.mockResolvedValueOnce({
      url: 'https://overpass-api.de/api/interpreter',
      statusCode: 200,
      body: {
        kind: 'text',
        content: JSON.stringify({
          elements: [{
            type: 'way',
            id: 1001,
            tags: { name: '广州市第一人民医院', amenity: 'hospital', operator: '广州市卫生健康委员会' },
            geometry: [
              { lon: 113.2, lat: 23.1 },
              { lon: 113.21, lat: 23.1 },
              { lon: 113.21, lat: 23.11 },
              { lon: 113.2, lat: 23.1 },
            ],
          }, {
            // Inside the boundary envelope but outside its actual triangular Polygon.
            type: 'way',
            id: 1002,
            tags: { name: '相邻区医院', amenity: 'hospital' },
            geometry: [
              { lon: 113.1, lat: 23.8 },
              { lon: 113.11, lat: 23.8 },
              { lon: 113.11, lat: 23.81 },
              { lon: 113.1, lat: 23.8 },
            ],
          }, {
            // Inside an excluded hole of the station Polygon.
            type: 'way',
            id: 1003,
            tags: { name: '局点范围空洞内医院', amenity: 'hospital' },
            geometry: [
              { lon: 113.47, lat: 23.06 },
              { lon: 113.48, lat: 23.06 },
              { lon: 113.48, lat: 23.07 },
              { lon: 113.47, lat: 23.06 },
            ],
          }],
        }),
      },
      truncated: false,
    })
    const refreshed = await context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })
    expect(refreshed).toMatchObject({
      workspaceId: SITE_ID,
      aois: [{
        id: 'osm-way-1001',
        name: '广州市第一人民医院',
        category: '医疗',
        entities: [{
          id: 'osm-way-1001',
          type: 'medical_facility',
          fields: { osm_id: 1001, amenity: 'hospital' },
        }],
        provenance: [{
          sourceId: 'osm-overpass',
          sourceName: 'OpenStreetMap / Overpass API',
          sourceUrl: 'https://www.openstreetmap.org/way/1001',
          license: 'ODbL-1.0',
        }],
      }],
    })
    expect(refreshed.aois[0]?.provenance[0]?.checksum).toMatch(/^sha256:/u)
    expect(refreshed.aois.some(aoi => aoi.id === 'osm-way-1002')).toBe(false)
    expect(refreshed.aois.some(aoi => aoi.id === 'osm-way-1003')).toBe(false)
    const overpassRequest = new URL(fetch.mock.calls[1]![0].url)
    expect(overpassRequest.hostname).toBe('overpass-api.de')
    expect(overpassRequest.searchParams.get('data')).toContain('["amenity"')
    expect(put).toHaveBeenCalledTimes(4)

    fetch.mockResolvedValueOnce({
      url: 'https://overpass-api.de/api/interpreter',
      statusCode: 200,
      body: {
        kind: 'text',
        content: JSON.stringify({
          elements: [
            null,
            { type: 'node', id: 9, tags: { amenity: 'bank' } },
            { type: 'way', id: 'invalid', tags: { amenity: 'bank' } },
            { type: 'way', id: 10, tags: null },
            { type: 'way', id: 11, tags: { amenity: 'cafe' }, geometry: [] },
            { type: 'way', id: 12, tags: { amenity: 'bank' }, geometry: [] },
            { type: 'way', id: 13, tags: { amenity: 'bank' }, geometry: [null, { lon: 113, lat: 23 }] },
            {
              type: 'way', id: 14, tags: { amenity: 'bank' },
              geometry: [{ lon: 'invalid', lat: 23 }, { lon: 113, lat: 23 }],
            },
            {
              type: 'way', id: 15, tags: { amenity: 'bank' },
              geometry: [{ lon: 113, lat: 23 }, { lon: 113, lat: 23 }],
            },
            { type: 'relation', id: 16, tags: { amenity: 'bank' }, members: null },
            {
              type: 'relation', id: 17, tags: { amenity: 'bank' },
              members: [
                null,
                { type: 'node', role: 'outer' },
                { type: 'way', role: 'outer', geometry: [null, { lon: 113, lat: 23 }] },
                {
                  type: 'way', role: 'side',
                  geometry: [
                    { lon: 113, lat: 23 }, { lon: 114, lat: 23 },
                    { lon: 114, lat: 24 }, { lon: 113, lat: 23 },
                  ],
                },
              ],
            },
            {
              type: 'relation', id: 18, tags: { amenity: 'bank' },
              members: [
                { type: 'way', role: 'outer', geometry: [{ lon: 113, lat: 23 }, { lon: 114, lat: 23 }] },
                { type: 'way', role: 'outer', geometry: [{ lon: 115, lat: 24 }, { lon: 116, lat: 24 }] },
              ],
            },
            {
              type: 'relation', id: 19, tags: { amenity: 'bank' },
              members: [
                { type: 'way', role: 'outer', geometry: [{ lon: 114, lat: 23 }, { lon: 114, lat: 24 }] },
                { type: 'way', role: 'outer', geometry: [{ lon: 114, lat: 23 }, { lon: 113, lat: 23 }] },
              ],
            },
            {
              type: 'relation', id: 20, tags: { amenity: 'bank' },
              members: [
                { type: 'way', role: 'outer', geometry: [{ lon: 114, lat: 23 }, { lon: 114, lat: 24 }] },
                { type: 'way', role: 'outer', geometry: [{ lon: 113, lat: 23 }, { lon: 114, lat: 23 }] },
              ],
            },
            {
              type: 'relation', id: 21, tags: { amenity: 'bank' },
              members: [
                { type: 'way', role: 'outer', geometry: [{ lon: 113, lat: 23 }, { lon: 114, lat: 23 }] },
                { type: 'way', role: 'outer', geometry: [{ lon: 115, lat: 23 }, { lon: 114, lat: 23 }] },
              ],
            },
            {
              type: 'relation',
              id: 2001,
              tags: { name: '政务中心', office: 'government' },
              members: [
                { type: 'way', role: 'outer', geometry: [{ lon: 113, lat: 23 }, { lon: 114, lat: 23 }] },
                { type: 'way', role: 'outer', geometry: [{ lon: 114, lat: 23 }, { lon: 114, lat: 24 }] },
                { type: 'way', role: 'outer', geometry: [{ lon: 114, lat: 24 }, { lon: 113, lat: 24 }] },
                { type: 'way', role: 'outer', geometry: [{ lon: 113, lat: 24 }, { lon: 113, lat: 23 }] },
                {
                  type: 'way',
                  role: 'inner',
                  geometry: [
                    { lon: 113.2, lat: 23.2 }, { lon: 113.4, lat: 23.2 },
                    { lon: 113.4, lat: 23.4 }, { lon: 113.2, lat: 23.4 }, { lon: 113.2, lat: 23.2 },
                  ],
                },
                {
                  type: 'way',
                  role: 'inner',
                  geometry: [
                    { lon: 120, lat: 30 }, { lon: 121, lat: 30 },
                    { lon: 121, lat: 31 }, { lon: 120, lat: 31 }, { lon: 120, lat: 30 },
                  ],
                },
              ],
            },
            {
              type: 'relation', id: 2002, tags: { name: '产业园', building: 'office', ignored: 7 },
              members: [{
                type: 'way', role: '',
                geometry: [
                  { lon: 113, lat: 23 }, { lon: 113.1, lat: 23 },
                  { lon: 113.1, lat: 23.1 }, { lon: 113, lat: 23 },
                ],
              }, {
                type: 'way', role: 'outer',
                geometry: [
                  { lon: 114, lat: 24 }, { lon: 114.1, lat: 24 },
                  { lon: 114.1, lat: 24.1 }, { lon: 114, lat: 24 },
                ],
              }],
            },
            {
              type: 'way', id: 2003, tags: { name: '银行', amenity: 'bank' },
              geometry: [
                { lon: 113, lat: 23 }, { lon: 113.1, lat: 23 },
                { lon: 113.1, lat: 23.1 }, { lon: 113, lat: 23 },
              ],
            },
            {
              type: 'way', id: 2004, tags: { name: '学校', amenity: 'school' },
              geometry: [
                { lon: 113, lat: 23 }, { lon: 113.1, lat: 23 },
                { lon: 113.1, lat: 23.1 }, { lon: 113, lat: 23 },
              ],
            },
            {
              type: 'way', id: 2005, tags: { name: '医院', building: 'hospital' },
              geometry: [
                { lon: 113, lat: 23 }, { lon: 113.1, lat: 23 },
                { lon: 113.1, lat: 23.1 }, { lon: 113, lat: 23 },
              ],
            },
            {
              type: 'way', id: 2006, tags: { name: '商场', shop: 'mall' },
              geometry: [
                { lon: 113, lat: 23 }, { lon: 113.1, lat: 23 },
                { lon: 113.1, lat: 23.1 }, { lon: 113, lat: 23 },
              ],
            },
            {
              type: 'way', id: 2007, tags: { name: '居民区', landuse: 'residential' },
              geometry: [
                { lon: 113, lat: 23 }, { lon: 113.1, lat: 23 },
                { lon: 113.1, lat: 23.1 }, { lon: 113, lat: 23 },
              ],
            },
          ],
        }),
      },
      truncated: false,
    })
    const classified = await context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })
    expect(classified.aois.map(item => item.category)).toEqual([
      '政', '企', '金融', '教育', '医疗', '商场', '居民区',
    ])
    expect(classified.aois[0]?.geometry.type).toBe('Polygon')
    expect(classified.aois[0]?.geometry.coordinates).toHaveLength(2)
    expect(classified.aois[1]?.geometry.type).toBe('MultiPolygon')
    expect(put).toHaveBeenCalledTimes(5)

    await expect(context.gstarSpatial.refreshAois({ workspaceId: ORDINARY_ID }))
      .rejects.toThrow('is not a GSTAR station')
    const locatedRecord = records.get(SITE_ID)
    records.set(SITE_ID, { aois: [], updatedAt: '2026-08-28T00:00:00.000Z' })
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID }))
      .rejects.toThrow('请先完成局点自动定位')
    if (locatedRecord !== undefined) records.set(SITE_ID, locatedRecord)

    fetch.mockRejectedValueOnce(new Error('Overpass unavailable'))
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID }))
      .rejects.toThrow('OpenStreetMap AOI 获取失败：Overpass unavailable')
    fetch.mockResolvedValueOnce({
      url: 'https://overpass-api.de/api/interpreter', statusCode: 429,
      body: { kind: 'text', content: '{}' }, truncated: false,
    })
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })).rejects.toThrow('Overpass HTTP 429')
    fetch.mockResolvedValueOnce({
      url: 'https://overpass-api.de/api/interpreter', statusCode: 200,
      body: { kind: 'text', content: '{}' }, truncated: true,
    })
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })).rejects.toThrow('响应超过')
    fetch.mockResolvedValueOnce({
      url: 'https://overpass-api.de/api/interpreter', statusCode: 200,
      body: { kind: 'text', content: '{not json' }, truncated: false,
    })
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })).rejects.toThrow('invalid JSON')
    fetch.mockResolvedValueOnce(response('{}'))
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID }))
      .rejects.toThrow('without an elements array')
    fetch.mockRejectedValueOnce(new Error('Overpass wrapper', { cause: 'socket detail' }))
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID }))
      .rejects.toThrow('Overpass wrapper <- socket detail')
    fetch.mockRejectedValueOnce(new Error('Overpass object', { cause: { code: 'ECONNRESET' } }))
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID }))
      .rejects.toThrow('Overpass object <- {"code":"ECONNRESET"}')
    fetch.mockRejectedValueOnce(new Error('duplicate', { cause: new Error('duplicate') }))
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })).rejects.toThrow('duplicate')

    fetch
      .mockRejectedValueOnce(new Error('web fetch failed', { cause: new Error('ECONNRESET') }))
      .mockResolvedValueOnce({
        url: 'https://photon.komoot.io/api/', statusCode: 200,
        body: {
          kind: 'text',
          content: '{"features":[{"geometry":{"type":"Point","coordinates":[113.2644,23.1291]}}]}',
        },
        truncated: false,
      })
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州局点' }))
      .resolves.not.toHaveProperty('boundary')
    const photonRequest = fetch.mock.calls.at(-1)?.[0]
    expect(new URL(photonRequest?.url ?? 'https://invalid.local').hostname).toBe('photon.komoot.io')
    expect(put).toHaveBeenCalledTimes(6)

    fetch.mockResolvedValueOnce({
      url: 'https://overpass-api.de/api/interpreter', statusCode: 200,
      body: { kind: 'text', content: '{"elements":[]}' }, truncated: false,
    })
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })).resolves.toMatchObject({ aois: [] })
    expect(put).toHaveBeenCalledTimes(7)

    fetch.mockRejectedValue(new Error('web fetch failed', { cause: new Error('ECONNRESET') }))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州局点' }))
      .rejects.toThrow(/Nominatim.*Photon.*ECONNRESET/u)
    expect(put).toHaveBeenCalledTimes(7)

    const fallbackGeometry = [
      { lon: 113, lat: 23 }, { lon: 113.1, lat: 23 },
      { lon: 113.1, lat: 23.1 }, { lon: 113, lat: 23 },
    ]
    fetch.mockReset()
    fetch.mockResolvedValueOnce(response(JSON.stringify({
      elements: [
        { type: 'way', id: 3001, tags: { 'name:zh': '中文名', amenity: 'bank' }, geometry: fallbackGeometry },
        { type: 'way', id: 3002, tags: { brand: '品牌名', amenity: 'bank' }, geometry: fallbackGeometry },
        { type: 'way', id: 3003, tags: { operator: '运营方', amenity: 'bank' }, geometry: fallbackGeometry },
        { type: 'way', id: 3004, tags: { amenity: 'bank' }, geometry: fallbackGeometry },
      ],
    })))
    const namedAois = await context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })
    expect(namedAois.aois.map(item => item.name)).toEqual(['中文名', '品牌名', '运营方', '金融 AOI 3004'])

    const recordBeforeLocationlessPatch = records.get(SITE_ID)
    records.set(SITE_ID, { aois: [], updatedAt: '2026-08-28T00:00:00.000Z' })
    await expect(context.gstarSpatial.patch({ workspaceId: SITE_ID, aois: [] }))
      .resolves.not.toHaveProperty('location')
    if (recordBeforeLocationlessPatch !== undefined) records.set(SITE_ID, recordBeforeLocationlessPatch)

    await expect(context.gstarSpatial.locate({ workspaceId: ORDINARY_ID, query: '广州' }))
      .rejects.toThrow('is not a GSTAR station')
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '   ' }))
      .rejects.toThrow('requires a station name')

    fetch.mockReset()
    fetch.mockResolvedValueOnce(response(JSON.stringify([{
      lat: '23.1', lon: '113.2', geojson: { type: 'LineString', coordinates: [] },
      boundingbox: ['23', '24', '113', '114'],
    }])))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
      .resolves.toMatchObject({ boundary: { type: 'Polygon' } })

    fetch.mockResolvedValueOnce(response(JSON.stringify([
      { lat: null, lon: null },
      { lat: 'invalid', lon: 'invalid' },
      {
        lat: 23, lon: 113,
        geojson: {
          type: 'MultiPolygon',
          coordinates: [[[[113, 23], [114, 23], [114, 24], [113, 23]]]],
        },
      },
    ])))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
      .resolves.toMatchObject({ boundary: { type: 'MultiPolygon' } })

    fetch.mockResolvedValueOnce(response('{"elements":[]}'))
    await expect(context.gstarSpatial.refreshAois({ workspaceId: SITE_ID })).resolves.toMatchObject({ aois: [] })

    const malformedGeometries: readonly unknown[] = [
      null,
      { type: 'Polygon', coordinates: [] },
      { type: 'Polygon', coordinates: [[[113, 23], [114, 23], [113, 23]]] },
      { type: 'Polygon', coordinates: [[null, null, null, null]] },
      { type: 'Polygon', coordinates: [[[999, 23], [114, 23], [114, 24], [999, 23]]] },
      { type: 'Polygon', coordinates: [[[113, 23], [114, 23], [114, 24], [113, 24]]] },
      { type: 'MultiPolygon', coordinates: [] },
      { type: 'MultiPolygon', coordinates: [[[]]] },
      { type: 'LineString', coordinates: [] },
    ]
    for (const geojson of malformedGeometries) {
      fetch.mockResolvedValueOnce(response(JSON.stringify([{ lat: 23, lon: 113, geojson }])))
      await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
        .resolves.not.toHaveProperty('boundary')
    }

    fetch.mockResolvedValueOnce(response(JSON.stringify([{
      lat: 23, lon: 113, geojson: null, boundingbox: ['24', '23', '114', '113'],
    }])))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
      .resolves.not.toHaveProperty('boundary')

    fetch
      .mockResolvedValueOnce(response('[]'))
      .mockResolvedValueOnce(response(JSON.stringify({
        features: [
          null,
          { geometry: null },
          { geometry: { type: 'LineString', coordinates: [] } },
          { geometry: { type: 'Point', coordinates: ['invalid', 23] } },
          { geometry: { type: 'Point', coordinates: [113, 23] } },
        ],
      })))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
      .resolves.toMatchObject({ location: { longitude: 113, latitude: 23 } })

    fetch
      .mockResolvedValueOnce(response('[]'))
      .mockResolvedValueOnce(response('{"features":[]}'))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
      .rejects.toThrow('未找到局点')

    fetch
      .mockResolvedValueOnce(response('{}'))
      .mockResolvedValueOnce(response('{}'))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
      .rejects.toThrow(/non-array.*non-FeatureCollection/u)

    fetch
      .mockResolvedValueOnce(response('{}', 503))
      .mockResolvedValueOnce(response('{}', 200, true))
    await expect(context.gstarSpatial.locate({ workspaceId: SITE_ID, query: '广州' }))
      .rejects.toThrow(/HTTP 503.*configured fetch limit/u)

    await expect(context.gstarSpatial.patch({ workspaceId: ORDINARY_ID, location: { longitude: 0, latitude: 0 } }))
      .rejects.toThrow('is not a GSTAR station')
    await expect(context.gstarSpatial.patch({ workspaceId: SITE_ID }))
      .rejects.toThrow('requires location, boundary, or aois')

    expect(deletionParticipant).toBeTypeOf('function')
    const preparation = await deletionParticipant!(SITE_ID)
    expect(remove).toHaveBeenCalledWith(SITE_ID)
    expect(records.has(SITE_ID)).toBe(false)
    expect(preparation).toBeTypeOf('object')
    await expect(context.gstarSpatial.patch({ workspaceId: SITE_ID, location: { longitude: 1, latitude: 1 } }))
      .rejects.toThrow('is being deleted')
    await preparation!.rollback()
    expect(records.has(SITE_ID)).toBe(true)

    const committedPreparation = await deletionParticipant!(SITE_ID)
    committedPreparation!.commit()
    expect(records.has(SITE_ID)).toBe(false)

    if (locatedRecord !== undefined) records.set(SITE_ID, locatedRecord)
    remove.mockRejectedValueOnce(new Error('storage delete failed'))
    await expect(deletionParticipant!(SITE_ID)).rejects.toThrow('storage delete failed')
    records.delete(SITE_ID)
    const emptyPreparation = await deletionParticipant!(SITE_ID)
    await emptyPreparation!.rollback()
    expect(records.has(SITE_ID)).toBe(false)

    const service = context.gstarSpatial
    await context.fiber.dispose()
    context = undefined
    expect(close).toHaveBeenCalledOnce()
    expect(removeParticipant).toHaveBeenCalledOnce()
    await expect(service.patch({ workspaceId: SITE_ID, location: { longitude: 1, latitude: 1 } }))
      .rejects.toThrow('GSTAR spatial storage is disposing')
  })

  it('rejects invalid configuration and closes a domain when participant registration fails', async () => {
    const config = {
      overpassEndpoint: 'https://overpass-api.de/api/interpreter',
      overpassTimeoutSeconds: 120,
      overpassMaxElements: 2_000,
      fallbackRadiusMeters: 15_000,
    }
    const badContext = new Context()
    expect(() => new StorageGstarSpatialService(badContext, {
      ...config,
      overpassEndpoint: 'file:///tmp/overpass',
    })).toThrow('must use http or https')
    await badContext.fiber.dispose()

    const close = vi.fn(async () => {})
    const failedContext = new Context()
    failedContext.provide('storageDomain', {
      open: vi.fn(async () => ({
        table: () => ({ get: () => undefined, put: vi.fn(), delete: vi.fn() }),
        close,
      })),
    } as never)
    failedContext.provide('gstarSites', {
      list: async () => [SITE],
      registerDeletionParticipant: () => { throw new Error('participant registration failed') },
    } as never)
    failedContext.provide('web', { fetch: vi.fn() } as never)

    class ExposedStorageGstarSpatialService extends StorageGstarSpatialService {
      initForTest(): Promise<void> { return this[Service.init]() }
    }
    const failedService = new ExposedStorageGstarSpatialService(failedContext, config)
    await expect(failedService.list()).rejects.toThrow('is not initialized')
    await expect(failedService.initForTest()).rejects.toThrow('participant registration failed')
    expect(close).toHaveBeenCalledOnce()
    await expect(failedService.list()).rejects.toThrow('is not initialized')
    await failedContext.fiber.dispose()
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-spatial-storage', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (value: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
