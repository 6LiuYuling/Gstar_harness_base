// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { GstarApp, type GstarAppProps } from '../src/client/GstarApp.tsx'

afterEach(cleanup)

function props(items: WorkspaceListState['items'] = [], createSite = vi.fn()): GstarAppProps {
  const state: WorkspaceListState = {
    items,
    archivedSessionIds: [],
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId: undefined,
  }
  return {
    createSite,
    useWorkspaces: <S,>(selector: (value: WorkspaceListState) => S) => selector(state),
    useSessions: () => undefined,
    useProjection: () => undefined,
  } as unknown as GstarAppProps
}

describe('GstarApp', () => {
  it('projects real Workspaces as station workspaces without inventing region counts', () => {
    render(<GstarApp {...props([{
      workspaceId: 'workspace-1',
      path: '/data/stations/guangzhou',
      title: '中国 · 广州局点',
      sessionIds: ['session-1'],
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-21T08:00:00.000Z',
    } as never])} />)

    expect(screen.getByRole('heading', { name: '中国 · 广州局点' })).toBeTruthy()
    expect(screen.getByText('/data/stations/guangzhou')).toBeTruthy()
    expect(screen.getByText('待配置')).toBeTruthy()
    expect(screen.getByText('1', { selector: 'dd' })).toBeTruthy()
  })

  it('switches to a service placeholder without losing the root shell', () => {
    render(<GstarApp {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: '数据源插件' }))

    expect(screen.getByRole('heading', { name: '运行时服务正在接入' })).toBeTruthy()
    expect(screen.getByLabelText('GSTAR Harness')).toBeTruthy()
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
    render(<GstarApp {...props([], createSite)} />)

    fireEvent.click(screen.getByRole('button', { name: '创建局点' }))
    fireEvent.change(screen.getByLabelText('Host 已有目录'), { target: { value: '/data/stations/guangzhou' } })
    fireEvent.change(screen.getByLabelText('局点名称（可选）'), { target: { value: '广州局点' } })
    fireEvent.click(screen.getByRole('button', { name: '连接 Workspace' }))

    await waitFor(() => {
      expect(createSite).toHaveBeenCalledWith({ path: '/data/stations/guangzhou', title: '广州局点' })
    })
    expect((await screen.findByRole('status')).textContent).toContain('已连接局点：广州局点')
  })
})
