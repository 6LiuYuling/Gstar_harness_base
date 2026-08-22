import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import WorkspaceGstarSiteService from '../src/index.ts'
import * as invariant from '../src/invariant.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

function workspace(id: string, path: string, title: string): Workspace {
  return {
    id: WorkspaceId(id),
    path,
    title,
    sessionIds: [],
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-21T08:00:00.000Z',
    async setTitle() {},
    async attachSession() {},
    async insertSessionBefore() {},
    async detachSession() {},
    async status() { return 'ok' },
  }
}

describe('gstar-site-workspace through a real Loader composition', () => {
  it('projects durable Workspace order and delegates station creation', async () => {
    const first = workspace('site-1', '/stations/guangzhou', '广州局点')
    const created = workspace('site-2', '/stations/shenzhen', '深圳局点')
    const create = vi.fn(async () => created)

    root = await mkdtemp(join(tmpdir(), 'dsh-gstar-site-workspace-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, "- name: '@deepseek-ai/dsh-gstar-site-workspace'\n")

    context = new Context()
    context.provide('workspaceRegistry', { list: () => [first], create } as never)
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (specifier === '@deepseek-ai/dsh-gstar-site-workspace') return WorkspaceGstarSiteService
        throw new Error(`unexpected Loader import: ${specifier}`)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()

    await expect(context.gstarSites.list()).resolves.toEqual([{
      workspaceId: first.id,
      path: first.path,
      title: first.title,
      sessionCount: 0,
      createdAt: first.createdAt,
      updatedAt: first.updatedAt,
    }])
    await expect(context.gstarSites.create({ path: created.path, title: created.title }))
      .resolves.toMatchObject({ workspaceId: created.id, path: created.path, title: created.title })
    expect(create).toHaveBeenCalledWith(created.path, created.title)
  })

  it('registers its package invariant', async () => {
    const register = vi.fn().mockReturnValue(() => {})
    const ctx = { invariants: { register } } as never
    const dispose = await invariant.apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-gstar-site-workspace', expect.any(Function))
    expect(() => { (register.mock.calls[0]![1] as (value: never) => void)(undefined as never) }).not.toThrow()
    expect(dispose).toBeTypeOf('function')
  })
})
