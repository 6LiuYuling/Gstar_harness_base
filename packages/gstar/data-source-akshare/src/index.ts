/** Register AKShare as a dynamically loadable listed-company enrichment source for GSTAR. */

import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { GstarDataSourceId } from '@deepseek-ai/dsh-gstar-data-source'
import type {} from '@deepseek-ai/dsh-gstar-site'
import type {} from '@deepseek-ai/dsh-gstar-spatial'
import type { GstarEntityFieldValue, GstarSpatialSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import type {} from '@deepseek-ai/dsh-subprocess'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { AKSHARE_BRIDGE } from './bridge.ts'

/** Cordis plugin name. */
export const name = 'gstar-data-source-akshare'
/** Services required to register and execute AKShare enrichment. */
export const inject = ['gstarDataSources', 'gstarSites', 'gstarSpatial', 'subprocess']

/** Stable source identity used by configuration and provenance. */
export const AKSHARE_DATA_SOURCE_ID = GstarDataSourceId('akshare-a-share')

/** Deployment controls for the bundled AKShare bridge process. */
export interface Config {
  /** Python executable resolved through the active subprocess Provider. */
  pythonExecutable: string
  /** PEM CA bundle passed to Python Requests; empty preserves its inherited trust configuration. */
  caBundlePath: string
  /** Disable certificate and hostname verification inside the isolated bridge child. */
  insecureSkipTlsVerify: boolean
  /** Persistent AKShare/CNInfo CSV read before any remote request; empty disables local lookup. */
  profileDatabasePath: string
  /** Maximum retries after each transient upstream request failure. */
  requestMaxRetries: number
  /** Delay in milliseconds between upstream request attempts. */
  requestRetryDelayMilliseconds: number
  /** Maximum matched company profiles requested in one station synchronization. */
  maxProfiles: number
  /** Complete bridge deadline in milliseconds. */
  timeoutMilliseconds: number
  /** Per-stream in-memory collection limit in bytes. */
  maxOutputBytes: number
}

/** Loader-visible AKShare bridge configuration. */
export const Config: z<Config> = z.object({
  pythonExecutable: z.string().required(),
  caBundlePath: z.string().default(''),
  insecureSkipTlsVerify: z.boolean().default(false),
  profileDatabasePath: z.string().default(''),
  requestMaxRetries: z.natural().max(5).default(2),
  requestRetryDelayMilliseconds: z.natural().min(100).max(60_000).default(1_000),
  maxProfiles: z.natural().min(1).max(500).required(),
  timeoutMilliseconds: z.natural().min(1_000).max(600_000).required(),
  maxOutputBytes: z.natural().min(16_384).max(16_777_216).required(),
})

interface AkshareBridgeRecord {
  readonly aoiId: string
  readonly code: string
  readonly fields: Readonly<Record<string, GstarEntityFieldValue>>
}

interface AkshareBridgeResult {
  readonly records: readonly AkshareBridgeRecord[]
  readonly unavailable?: string
  readonly cacheUsed?: boolean
}

/** Render the actionable error tail without exposing the child environment. */
function bridgeError(stderr: string): string {
  const message = stderr.trim()
  if (/CERTIFICATE_VERIFY_FAILED|self[- ]signed certificate in certificate chain/iu.test(message)) {
    return 'AKShare TLS 证书校验失败：请将企业 CA 的 PEM 文件配置为 caBundlePath，'
      + '或在启动前设置 REQUESTS_CA_BUNDLE；仅在可信内网临时排障时设置 insecureSkipTlsVerify: true'
  }
  return message.length === 0 ? 'AKShare bridge exited without a diagnostic' : message
}

/** Decode the trusted bridge's records or explicit upstream-unavailable result. */
function decodeBridge(content: string): AkshareBridgeResult {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (cause) {
    throw new Error('AKShare bridge returned invalid JSON', { cause })
  }
  if (value === null || typeof value !== 'object' || !Array.isArray((value as { records?: unknown }).records)) {
    throw new Error('AKShare bridge returned a payload without records')
  }
  const inputResult = value as {
    readonly records: unknown[]
    readonly unavailable?: unknown
    readonly cacheUsed?: unknown
  }
  if (inputResult.unavailable !== undefined
    && (typeof inputResult.unavailable !== 'string' || inputResult.unavailable.length === 0
      || inputResult.records.length !== 0)) {
    throw new Error('AKShare bridge returned an invalid unavailable result')
  }
  if (inputResult.cacheUsed !== undefined && inputResult.cacheUsed !== true) {
    throw new Error('AKShare bridge returned an invalid cache result')
  }
  const records: AkshareBridgeRecord[] = []
  for (const candidate of inputResult.records) {
    if (candidate === null || typeof candidate !== 'object') {
      throw new Error('AKShare bridge returned an invalid company record')
    }
    const input = candidate as { readonly aoiId?: unknown; readonly code?: unknown; readonly fields?: unknown }
    if (typeof input.aoiId !== 'string' || input.aoiId.length === 0
      || typeof input.code !== 'string' || input.code.length === 0
      || input.fields === null || typeof input.fields !== 'object' || Array.isArray(input.fields)) {
      throw new Error('AKShare bridge returned an invalid company record')
    }
    const fields: Record<string, GstarEntityFieldValue> = {}
    for (const [key, field] of Object.entries(input.fields as Record<string, unknown>)) {
      if (typeof field !== 'string' && typeof field !== 'number'
        && typeof field !== 'boolean' && field !== null) {
        throw new Error(`AKShare bridge returned an invalid field ${key}`)
      }
      fields[key] = field
    }
    records.push({ aoiId: input.aoiId, code: input.code, fields })
  }
  return {
    records,
    ...(typeof inputResult.unavailable === 'string' ? { unavailable: inputResult.unavailable } : {}),
    ...(inputResult.cacheUsed === true ? { cacheUsed: true } : {}),
  }
}

/** Execute the bundled Python adapter and decode matched listed companies. */
async function collectCompanies(
  ctx: Context,
  config: Config,
  stationTitle: string,
  spatial: GstarSpatialSnapshot,
): Promise<AkshareBridgeResult> {
  const python = await ctx.subprocess.resolveExecutable(config.pythonExecutable)
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new Error(`AKShare synchronization exceeded ${String(config.timeoutMilliseconds)} ms`))
  }, config.timeoutMilliseconds)
  const input = JSON.stringify({
    stationTitle,
    maxProfiles: config.maxProfiles,
    insecureSkipTlsVerify: config.insecureSkipTlsVerify,
    profileDatabasePath: config.profileDatabasePath,
    requestMaxRetries: config.requestMaxRetries,
    requestRetryDelayMilliseconds: config.requestRetryDelayMilliseconds,
    aois: spatial.aois
      .filter(aoi => aoi.category === '企' || aoi.category === '金融')
      .map(aoi => ({
        id: aoi.id,
        name: aoi.name,
        aliases: aoi.entities.flatMap(entity => Object.entries(entity.fields)
          .filter(([key, value]) => ['name', 'name:zh', 'brand', 'operator'].includes(key)
            && typeof value === 'string')
          .map(([, value]) => value)),
      })),
  })
  const handle = ctx.subprocess.spawn({
    argv: [python, '-c', AKSHARE_BRIDGE],
    cwd: process.cwd(),
    stdio: {
      stdin: { data: input },
      stdout: { maxBytes: config.maxOutputBytes },
      stderr: { maxBytes: config.maxOutputBytes },
    },
    graceMs: 5_000,
    signal: controller.signal,
    env: {
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
      ...(config.caBundlePath.length === 0 ? {} : { REQUESTS_CA_BUNDLE: config.caBundlePath }),
    },
  })
  try {
    const outcome = await handle.done
    const stdoutView = handle.collected.stdout?.readFrom(0)
    const stderrView = handle.collected.stderr?.readFrom(0)
    const stdout = stdoutView?.text ?? ''
    const stderr = stderrView?.text ?? ''
    if (controller.signal.aborted) throw controller.signal.reason
    if (stdoutView?.lossy === true || stderrView?.lossy === true) {
      throw new Error('AKShare bridge output exceeded the configured collection limit')
    }
    if (outcome.exitCode !== 0) throw new Error(bridgeError(stderr))
    return decodeBridge(stdout)
  } finally {
    clearTimeout(timer)
  }
}

/** Enrich matching enterprise AOIs and commit the complete station publication once. */
async function synchronize(ctx: Context, config: Config, workspaceId: WorkspaceId): Promise<string> {
  const sites = await ctx.gstarSites.list()
  const site = sites.find(candidate => candidate.workspaceId === workspaceId)
  if (site === undefined) throw new Error(`AKShare: Workspace ${workspaceId} is not a GSTAR station`)
  const spatial = (await ctx.gstarSpatial.list()).find(candidate => candidate.workspaceId === workspaceId)
  if (spatial === undefined) throw new Error(`AKShare: station ${workspaceId} has no spatial projection`)
  const result = await collectCompanies(ctx, config, site.title, spatial)
  if (result.unavailable !== undefined) {
    return `${result.unavailable}；本次未更新，已保留现有 AOI 数据`
  }
  const records = result.records
  if (records.length === 0) {
    return result.cacheUsed === true
      ? '本地 AKShare 公司档案库未匹配到注册地址属于该局点的 A 股上市公司'
      : '未在当前企业 AOI 中匹配到注册地址属于该局点的 A 股上市公司'
  }
  const retrievedAt = new Date().toISOString()
  const byAoi = new Map(records.map(record => [record.aoiId, record]))
  const aois = spatial.aois.map((aoi) => {
    const record = byAoi.get(aoi.id)
    if (record === undefined) return aoi
    const entityId = `akshare-a-${record.code}`
    const entity = { id: entityId, type: 'listed_company', fields: record.fields }
    const provenance = {
      sourceId: AKSHARE_DATA_SOURCE_ID,
      sourceName: result.cacheUsed === true
        ? 'AKShare / 巨潮资讯公司概况（本地档案库）'
        : 'AKShare / 巨潮资讯公司概况',
      sourceUrl: 'https://webapi.cninfo.com.cn/#/company',
      retrievedAt,
      checksum: `sha256:${createHash('sha256').update(JSON.stringify(record)).digest('hex')}`,
    }
    return {
      ...aoi,
      entities: [...aoi.entities.filter(current => current.id !== entityId), entity],
      provenance: [
        ...aoi.provenance.filter(current => current.sourceId !== AKSHARE_DATA_SOURCE_ID),
        provenance,
      ],
      updatedAt: retrievedAt,
    }
  })
  await ctx.gstarSpatial.patch({ workspaceId, aois })
  return result.cacheUsed === true
    ? `已从本地 AKShare 公司档案库为 ${String(records.length)} 个企业 AOI 补充 A 股上市公司资料`
    : `已为 ${String(records.length)} 个企业 AOI 补充 A 股上市公司资料`
}

/**
 * Register the AKShare listed-company source contribution.
 * @param ctx - Host context carrying source, station, spatial, and subprocess capabilities.
 * @param config - Validated Python bridge limits.
 * @returns disposer for the exact live source contribution.
 * @throws when a CA bundle and disabled TLS verification are configured together.
 */
export function apply(ctx: Context, config: Config): () => void {
  if (config.caBundlePath.length > 0 && config.insecureSkipTlsVerify) {
    throw new Error('gstar-data-source-akshare: caBundlePath and insecureSkipTlsVerify are mutually exclusive')
  }
  return ctx.gstarDataSources.register({
    descriptor: {
      id: AKSHARE_DATA_SOURCE_ID,
      name: 'AKShare A 股上市公司',
      publisher: 'AKShare 开源项目（底层数据：沪深京交易所、巨潮资讯）',
      url: 'https://akshare.akfamily.xyz/data/stock/stock.html',
      categories: ['企', '金融'],
      capabilities: ['entity'],
      accessMode: 'direct',
      license: 'MIT（AKShare 代码；底层数据许可按发布方条款）',
      defaultEnabled: false,
    },
    synchronize: workspaceId => synchronize(ctx, config, workspaceId),
  })
}
