// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { GstarApp } from '../src/client/GstarApp.tsx'

afterEach(cleanup)

function props(items: WorkspaceListState['items'] = []) {
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
    useWorkspaces: <S,>(selector: (value: WorkspaceListState) => S) => selector(state),
    useSessions: () => undefined,
    useProjection: () => undefined,
  } as never
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
})
