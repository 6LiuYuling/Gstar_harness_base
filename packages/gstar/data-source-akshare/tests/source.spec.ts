import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { GstarDataSourceProvider } from '@deepseek-ai/dsh-gstar-data-source'
import type { GstarSpatialPatchRequest, GstarSpatialSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { AKSHARE_DATA_SOURCE_ID, apply, type Config } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

const SITE_ID = WorkspaceId('site-1')
const CONFIG: Config = {
  pythonExecutable: 'python',
  caBundlePath: '',
  insecureSkipTlsVerify: false,
  maxProfiles: 20,
  timeoutMilliseconds: 30_000,
  maxOutputBytes: 65_536,
}
const SPATIAL: GstarSpatialSnapshot = {
  workspaceId: SITE_ID,
  aois: [{
    id: 'osm-way-1',
    name: '示例科技园',
    category: '企',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        { longitude: 116.48, latitude: 39.92 },
        { longitude: 116.49, latitude: 39.92 },
        { longitude: 116.49, latitude: 39.93 },
        { longitude: 116.48, latitude: 39.92 },
      ]],
    },
    entities: [{ id: 'osm-way-1', type: 'facility', fields: { operator: '示例股份有限公司' } }],
    provenance: [{
      sourceId: 'osm-overpass',
      sourceName: 'OpenStreetMap',
      retrievedAt: '2026-08-29T08:00:00.000Z',
    }],
    updatedAt: '2026-08-29T08:00:00.000Z',
  }],
}

function config(overrides: Partial<Config> = {}): Config {
  return {
    pythonExecutable: overrides.pythonExecutable ?? CONFIG.pythonExecutable,
    caBundlePath: overrides.caBundlePath ?? CONFIG.caBundlePath,
    insecureSkipTlsVerify: overrides.insecureSkipTlsVerify ?? CONFIG.insecureSkipTlsVerify,
    maxProfiles: overrides.maxProfiles ?? CONFIG.maxProfiles,
    timeoutMilliseconds: overrides.timeoutMilliseconds ?? CONFIG.timeoutMilliseconds,
    maxOutputBytes: overrides.maxOutputBytes ?? CONFIG.maxOutputBytes,
  }
}

function handle(
  stdout: string,
  options: { readonly stderr?: string; readonly exitCode?: number; readonly lossy?: boolean } = {},
): SubprocessHandle {
  const read = (text: string) => ({
    readFrom: () => ({ text, nextOffset: Buffer.byteLength(text), lossy: options.lossy ?? false }),
  })
  return {
    pid: 1,
    stdin: undefined,
    stdout: undefined,
    stderr: undefined,
    collected: { stdout: read(stdout), stderr: read(options.stderr ?? '') },
    done: Promise.resolve({ exitCode: options.exitCode ?? 0, signal: null }),
    terminate() {},
    waitForExit: async () => true,
  }
}

function fixture(stdout: string, options?: Parameters<typeof handle>[1], config: Config = CONFIG) {
  let provider: GstarDataSourceProvider | undefined
  let spawnSpec: SubprocessSpawnSpec | undefined
  const patch = vi.fn(async (request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot> => ({
    workspaceId: request.workspaceId,
    aois: request.aois ?? SPATIAL.aois,
  }))
  const spawn = vi.fn((spec: SubprocessSpawnSpec) => {
    spawnSpec = spec
    return handle(stdout, options)
  })
  const ctx = {
    gstarDataSources: { register(value: GstarDataSourceProvider) { provider = value; return () => {} } },
    gstarSites: { list: async () => [{ workspaceId: SITE_ID, title: '北京市朝阳区' }] },
    gstarSpatial: { list: async () => [SPATIAL], patch },
    subprocess: { resolveExecutable: async () => '/usr/bin/python', spawn },
  }
  apply(ctx as never, config)
  if (provider?.synchronize === undefined) throw new Error('AKShare source did not register synchronize')
  return { ctx, patch, provider, spawn, getSpawnSpec: () => spawnSpec }
}

describe('gstar-data-source-akshare', () => {
  it('registers disabled-by-default AKShare metadata and enriches matched enterprise AOIs once', async () => {
    const subject = fixture(JSON.stringify({ records: [{
      aoiId: 'osm-way-1',
      code: '000001',
      fields: {
        company_name: '示例股份有限公司',
        stock_code: '000001',
        registered_address: '北京市朝阳区示例路 1 号',
      },
    }] }))

    expect(subject.provider.descriptor).toMatchObject({
      id: AKSHARE_DATA_SOURCE_ID,
      accessMode: 'direct',
      defaultEnabled: false,
      categories: ['企', '金融'],
      capabilities: ['entity'],
    })
    await expect(subject.provider.synchronize!(SITE_ID))
      .resolves.toBe('已为 1 个企业 AOI 补充 A 股上市公司资料')
    const request = subject.patch.mock.calls[0]![0]
    const aois = request.aois ?? []
    expect(aois[0]?.id).toBe('osm-way-1')
    expect(aois[0]?.entities).toContainEqual(
      expect.objectContaining({ id: 'akshare-a-000001', type: 'listed_company' }),
    )
    const provenance = aois[0]?.provenance
      .find(candidate => candidate.sourceId === AKSHARE_DATA_SOURCE_ID)
    expect(provenance?.checksum).toMatch(/^sha256:/)
    const spawnSpec = subject.getSpawnSpec()
    expect(spawnSpec?.argv[0]).toBe('/usr/bin/python')
    expect(spawnSpec?.argv[1]).toBe('-c')
    expect(spawnSpec?.argv[2]).toContain('stock_info_a_code_name')
    expect(spawnSpec?.env).toEqual({ PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' })
    const input = JSON.parse((spawnSpec?.stdio.stdin as { data: string }).data) as {
      stationTitle: string
      maxProfiles: number
      insecureSkipTlsVerify: boolean
      aois: Array<{ aliases: string[] }>
    }
    expect(input).toMatchObject({
      stationTitle: '北京市朝阳区', maxProfiles: 20, insecureSkipTlsVerify: false,
    })
    expect(input.aois[0]?.aliases).toContain('示例股份有限公司')
  })

  it('passes a configured CA bundle to Requests without disabling verification', async () => {
    const subject = fixture('{"records":[]}', undefined, config({
      caBundlePath: 'C:\\certificates\\enterprise-ca.pem',
    }))
    await subject.provider.synchronize!(SITE_ID)
    expect(subject.getSpawnSpec()?.env).toEqual({
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
      REQUESTS_CA_BUNDLE: 'C:\\certificates\\enterprise-ca.pem',
    })
  })

  it('requires an explicit mutually exclusive switch for insecure bridge TLS', async () => {
    const subject = fixture('{"records":[]}', undefined, config({
      insecureSkipTlsVerify: true,
    }))
    await subject.provider.synchronize!(SITE_ID)
    const spawnSpec = subject.getSpawnSpec()
    const input = JSON.parse((spawnSpec?.stdio.stdin as { data: string }).data) as {
      insecureSkipTlsVerify: boolean
    }
    expect(input.insecureSkipTlsVerify).toBe(true)
    expect(spawnSpec?.argv[2]).toContain('kwargs["verify"] = False')
    expect(() => fixture('{"records":[]}', undefined, config({
      caBundlePath: 'enterprise-ca.pem',
      insecureSkipTlsVerify: true,
    }))).toThrow('mutually exclusive')
  })

  it('does not rewrite spatial data when no address-qualified company matches', async () => {
    const subject = fixture('{"records":[]}')
    await expect(subject.provider.synchronize!(SITE_ID))
      .resolves.toContain('未在当前企业 AOI 中匹配到')
    expect(subject.patch).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid JSON', 'not-json', {}, 'invalid JSON'],
    ['bridge failure', '', { exitCode: 1, stderr: 'akshare unavailable' }, 'akshare unavailable'],
    [
      'TLS certificate failure', '',
      { exitCode: 1, stderr: 'SSLError: CERTIFICATE_VERIFY_FAILED: self-signed certificate in certificate chain' },
      'caBundlePath',
    ],
    ['truncated output', '{"records":[]}', { lossy: true }, 'collection limit'],
    ['invalid record', '{"records":[{"aoiId":"a","code":"1","fields":{"bad":[]}}]}', {}, 'invalid field bad'],
  ] as const)('rejects %s without patching partial data', async (_label, stdout, options, message) => {
    const subject = fixture(stdout, options)
    await expect(subject.provider.synchronize!(SITE_ID)).rejects.toThrow(message)
    expect(subject.patch).not.toHaveBeenCalled()
  })

  it('rejects stations or spatial projections that disappear before synchronization', async () => {
    const subject = fixture('{"records":[]}')
    subject.ctx.gstarSites.list = async () => []
    await expect(subject.provider.synchronize!(SITE_ID)).rejects.toThrow('is not a GSTAR station')
    subject.ctx.gstarSites.list = async () => [{ workspaceId: SITE_ID, title: '北京市朝阳区' }]
    subject.ctx.gstarSpatial.list = async () => []
    await expect(subject.provider.synchronize!(SITE_ID)).rejects.toThrow('has no spatial projection')
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const dispose = await invariant.apply({ invariants: { register } } as never)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-data-source-akshare', expect.any(Function))
    expect(dispose).toBeTypeOf('function')
  })
})
