/**
 * Serves CesiumJS runtime assets from the installed package through the DSH Web Host.
 * @module @deepseek-ai/dsh-gstar-cesium-assets
 */

import { readFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Browser base URL consumed by `window.CESIUM_BASE_URL`. */
export const CESIUM_ASSET_PREFIX = '/gstar/cesium'

/** Required Host service. */
export const inject = ['webServer']

const require = createRequire(import.meta.url)
const cesiumRoot = resolve(dirname(require.resolve('cesium/package.json')), 'Build', 'Cesium')

const MIME: Readonly<Record<string, string>> = {
  '.basis': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ktx2': 'image/ktx2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
}

const STATIC_MISS_CODES: ReadonlySet<string | undefined> = new Set(['ENOENT', 'EISDIR', 'ENOTDIR'])

/**
 * Serve one Cesium runtime asset while preventing traversal outside Build/Cesium.
 * @param pathname - Decoded request pathname.
 * @param res - HTTP response owned by this route.
 * @param assetRoot - Cesium Build/Cesium directory; overridable by tests.
 */
export async function serveCesiumAsset(
  pathname: string,
  res: ServerResponse,
  assetRoot = cesiumRoot,
): Promise<void> {
  const relative = pathname.slice(CESIUM_ASSET_PREFIX.length).replace(/^\/+/, '')
  if (relative === '') {
    res.writeHead(404)
    res.end()
    return
  }
  const target = resolve(assetRoot, relative)
  if (!target.startsWith(assetRoot + sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  try {
    const body = await readFile(target)
    res.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    })
    res.end(body)
  } catch (error) {
    if (!STATIC_MISS_CODES.has((error as NodeJS.ErrnoException).code)) throw error
    res.writeHead(404)
    res.end()
  }
}

/** Register the Cesium runtime-asset prefix route. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: CESIUM_ASSET_PREFIX,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      /* v8 ignore next -- node:http always supplies url for server requests. */
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
      await serveCesiumAsset(pathname, res)
    },
  }), 'gstar-cesium-assets: route')
}
