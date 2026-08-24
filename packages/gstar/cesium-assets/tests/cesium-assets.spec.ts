import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, CESIUM_ASSET_PREFIX, inject, serveCesiumAsset } from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

let root: string | undefined

afterEach(async () => {
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function response() {
  const state: { status?: number; headers?: unknown; body?: unknown } = {}
  const res = {
    writeHead(status: number, headers?: unknown) { state.status = status; state.headers = headers },
    end(body?: unknown) { state.body = body },
  } as unknown as ServerResponse
  return { res, state }
}

describe('gstar-cesium-assets', () => {
  it('serves immutable Cesium files with their browser MIME type', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-gstar-cesium-assets-'))
    await writeFile(join(root, 'widgets.css'), '.cesium-widget{}')
    const subject = response()

    await serveCesiumAsset(`${CESIUM_ASSET_PREFIX}/widgets.css`, subject.res, root)

    expect(subject.state.status).toBe(200)
    expect(subject.state.headers).toMatchObject({
      'content-type': 'text/css; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    })
    expect(String(subject.state.body)).toContain('.cesium-widget')
  })

  it('rejects traversal and returns 404 for empty or missing paths', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-gstar-cesium-assets-'))
    const traversal = response()
    await serveCesiumAsset(`${CESIUM_ASSET_PREFIX}/../secret`, traversal.res, root)
    expect(traversal.state.status).toBe(403)

    const empty = response()
    await serveCesiumAsset(`${CESIUM_ASSET_PREFIX}/`, empty.res, root)
    expect(empty.state.status).toBe(404)

    const missing = response()
    await serveCesiumAsset(`${CESIUM_ASSET_PREFIX}/missing.js`, missing.res, root)
    expect(missing.state.status).toBe(404)
  })

  it('registers a DSH Web Host prefix route and rejects unsupported methods', async () => {
    const register = vi.fn().mockImplementation(route => {
      expect(route.kind).toBe('prefix')
      expect(route.path).toBe(CESIUM_ASSET_PREFIX)
      return () => {}
    })
    const ctx = new Context()
    ctx.provide('webServer', { register } as never)
    expect(inject).toEqual(['webServer'])
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const route = register.mock.calls[0]![0] as {
      handler(req: { method?: string; url?: string }, res: ServerResponse): Promise<void>
    }
    const subject = response()
    await route.handler({ method: 'POST', url: `${CESIUM_ASSET_PREFIX}/Widgets/widgets.css` }, subject.res)
    expect(subject.state.status).toBe(405)
    await fiber.dispose()
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-cesium-assets', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (value: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
