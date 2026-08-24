// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSnapshotStore, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import { GstarApp, type GstarAppProps } from '../src/client/GstarApp.tsx'
import type { GstarSiteListState } from '../src/client/site-runtime.ts'

afterEach(cleanup)

function props(
  items: readonly GstarSiteSnapshot[] = [],
  createSite = vi.fn(),
  workspaces: WorkspaceListState['items'] = [],
  directoryFlow: { available?: boolean; pickedPath?: string } = {},
): GstarAppProps {
  const state: WorkspaceListState = {
    items: workspaces,
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId: undefined,
  }
  return {
    createSite,
    sites: createSnapshotStore<GstarSiteListState>({ items, phase: 'ready' }),
    useDirectoryFlow: <S,>(selector: (value: boolean) => S) => selector(directoryFlow.available ?? true),
    renderSlot: ((_name: string, owner: DirectoryFlowOwnerProps) => owner.open
      ? (
          <button
            type="button"
            onClick={() => { owner.onPicked(directoryFlow.pickedPath ?? '/data/stations/guangzhou') }}
          >
            选择此目录
          </button>
        )
      : null),
    useWorkspaces: <S,>(selector: (value: WorkspaceListState) => S) => selector(state),
    useSessions: () => undefined,
    useProjection: () => undefined,
  } as unknown as GstarAppProps
}

describe('GstarApp', () => {
  it('projects only Host-classified stations without leaking ordinary Workspaces', () => {
    render(<GstarApp {...props([{
      workspaceId: 'workspace-1',
      path: '/data/stations/guangzhou',
      title: '中国 · 广州局点',
      sessionCount: 1,
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-21T08:00:00.000Z',
    } as never], vi.fn(), [{
      workspaceId: 'ordinary-workspace',
      path: '/projects/ordinary',
      title: '普通 DSH 工作区',
      sessionIds: [],
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-21T08:00:00.000Z',
    } as never])} />)

    expect(screen.getByRole('heading', { name: '中国 · 广州局点' })).toBeTruthy()
    expect(screen.getByText('/data/stations/guangzhou')).toBeTruthy()
    expect(screen.getByText('待配置')).toBeTruthy()
    expect(screen.getByText('1', { selector: 'dd' })).toBeTruthy()
    expect(screen.getByText('已登记的 DSH Workspace 对应局点；普通 Web 工作区不会显示在这里。')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '普通 DSH 工作区' })).toBeNull()
  })

  it('switches to a service placeholder without losing the root shell', () => {
    render(<GstarApp {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: '数据源插件' }))

    expect(screen.getByRole('heading', { name: '运行时服务正在接入' })).toBeTruthy()
    expect(screen.getByLabelText('GSTAR Harness')).toBeTruthy()
  })

  it('shows GSTAR membership loading without projecting generic Workspaces', () => {
    const value = props([], vi.fn(), [{
      workspaceId: 'ordinary-workspace',
      path: '/projects/ordinary',
      title: '普通 DSH 工作区',
      sessionIds: [],
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-21T08:00:00.000Z',
    } as never])
    value.sites.set({ items: [], phase: 'loading' })
    render(<GstarApp {...value} />)

    expect(screen.getByText('正在同步局点工作区…')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '普通 DSH 工作区' })).toBeNull()
  })

  it('creates a station through the injected Host action', async () => {
    const createSite = vi.fn().mockResolvedValue({
      workspaceId: 'workspace-1',
      path: '/data/stations/guangzhou',
      title: '广州局点',
      sessionCount: 0,
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-21T08:00:00.000Z',
    })
    render(<GstarApp {...props([], createSite, [], { pickedPath: '/data/stations/guangzhou' })} />)

    fireEvent.click(screen.getByRole('button', { name: '创建局点' }))
    fireEvent.click(screen.getByRole('button', { name: '选择此目录' }))

    await waitFor(() => {
      expect(createSite).toHaveBeenCalledWith({ path: '/data/stations/guangzhou' })
    })
    expect((await screen.findByRole('status')).textContent).toContain('已连接局点：广州局点')
    expect(screen.queryByLabelText('Host 已有目录')).toBeNull()
  })

  it('surfaces a station-create failure without adding generic Workspace data', async () => {
    const createSite = vi.fn().mockRejectedValue(new Error('GSTAR membership write failed'))
    render(<GstarApp {...props([], createSite, [], { pickedPath: '/data/stations/failed' })} />)

    fireEvent.click(screen.getByRole('button', { name: '创建局点' }))
    fireEvent.click(screen.getByRole('button', { name: '选择此目录' }))

    expect((await screen.findByRole('alert')).textContent).toContain('GSTAR membership write failed')
    expect(createSite).toHaveBeenCalledWith({ path: '/data/stations/failed' })
  })

  it('disables station creation while no composed DSH directory flow is available', () => {
    render(<GstarApp {...props([], vi.fn(), [], { available: false })} />)

    expect(screen.getByRole('button', { name: '目录选择器加载中…' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByLabelText('Host 已有目录')).toBeNull()
  })

  it('renders a Host station-list failure without falling back to generic Workspaces', () => {
    const value = props([], vi.fn(), [{
      workspaceId: 'ordinary-workspace',
      path: '/projects/ordinary',
      title: '普通 DSH 工作区',
      sessionIds: [],
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-21T08:00:00.000Z',
    } as never])
    value.sites.set({ items: [], phase: 'error', error: 'INTERNAL: unavailable' })
    render(<GstarApp {...value} />)

    expect(screen.getByRole('alert').textContent).toContain('INTERNAL: unavailable')
    expect(screen.queryByRole('heading', { name: '普通 DSH 工作区' })).toBeNull()
  })
})
