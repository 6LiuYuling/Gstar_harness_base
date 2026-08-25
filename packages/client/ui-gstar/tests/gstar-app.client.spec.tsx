// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import type { GstarSpatialSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { GstarApp, type GstarAppProps } from '../src/client/GstarApp.tsx'
import { createGstarStore } from '../src/client/stores.ts'

vi.mock('../src/client/CesiumGlobe.tsx', () => ({
  CesiumGlobe: (props: {
    readonly sites: readonly GstarSiteSnapshot[]
    readonly selectedSiteId?: string
    readonly onSelectSite: (id: never) => void
    readonly onSelectAoi: (workspaceId: never, aoiId: string) => void
  }) => (
    <div aria-label="GSTAR Cesium 地球">
      {props.sites.map(site => (
        <button key={site.workspaceId} type="button" onClick={() => { props.onSelectSite(site.workspaceId as never) }}>
          地图局点：{site.title}
        </button>
      ))}
      {props.selectedSiteId === undefined ? null : (
        <button type="button" onClick={() => { props.onSelectAoi(props.selectedSiteId as never, 'aoi-1') }}>
          选择 AOI
        </button>
      )}
    </div>
  ),
}))

afterEach(cleanup)

const SITE: GstarSiteSnapshot = {
  workspaceId: 'workspace-1' as never,
  path: '/data/stations/guangzhou',
  title: '广州局点',
  sessionCount: 1,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-21T08:00:00.000Z',
}

const AOI_SPATIAL: GstarSpatialSnapshot = {
  workspaceId: SITE.workspaceId,
  location: { longitude: 113.3, latitude: 23.1 },
  aois: [{
    id: 'aoi-1',
    name: '天河道路 AOI',
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
    entities: [{ id: 'road-1', type: 'road', fields: { name: '体育西路', lanes: 4, verified: true } }],
    provenance: [{
      sourceId: 'osm-overpass',
      sourceName: 'OpenStreetMap Overpass',
      sourceUrl: 'https://overpass-api.de/',
      retrievedAt: '2026-08-21T08:00:00.000Z',
      license: 'ODbL-1.0',
      checksum: 'sha256:test',
    }],
    updatedAt: '2026-08-21T08:00:00.000Z',
  }],
}

function storeHook<T>(store: { subscribe(listener: () => void): () => void; getSnapshot(): T }) {
  return function useStore<S>(selector: (state: T) => S): S {
    return selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  }
}

function props(options: {
  readonly sites?: readonly GstarSiteSnapshot[]
  readonly spatial?: readonly GstarSpatialSnapshot[]
  readonly createSite?: GstarAppProps['createSite']
  readonly patchSpatial?: GstarAppProps['patchSpatial']
  readonly locateSpatial?: GstarAppProps['locateSpatial']
  readonly openSite?: GstarAppProps['openSite']
  readonly directoryAvailable?: boolean
} = {}): GstarAppProps {
  const store = createGstarStore().create()
  const sites = { items: options.sites ?? [], phase: 'ready' as const }
  const spatial = { items: options.spatial ?? [], phase: 'ready' as const }
  const renderSlot: GstarAppProps['renderSlot'] = (name, owner) => {
    if (name === 'conversation.hero.workspace.directoryFlow') {
      const flow = owner as unknown as DirectoryFlowOwnerProps
      return flow.open
        ? <button type="button" onClick={() => { flow.onPicked('/data/stations/new-site') }}>选择此目录</button>
        : null
    }
    if (name === 'conversation') return <div data-testid="dsh-conversation">DSH Conversation</div>
    if (name === 'details') return <div data-testid="dsh-details">DSH Details</div>
    return null
  }
  return {
    actions: store.actions,
    useStore: storeHook(store),
    SessionProvider: ({ children }) => children('session-1' as never),
    createSite: options.createSite ?? vi.fn(),
    patchSpatial: options.patchSpatial ?? vi.fn(),
    locateSpatial: options.locateSpatial ?? vi.fn(),
    openSite: options.openSite ?? vi.fn(),
    renderSlot,
    useSessions: (() => undefined) as GstarAppProps['useSessions'],
    useWorkspaces: (() => undefined) as GstarAppProps['useWorkspaces'],
    useDirectoryFlow: <S,>(selector: (available: boolean) => S) => selector(options.directoryAvailable ?? true),
    useSites: <S,>(selector: (state: typeof sites) => S) => selector(sites),
    useSpatial: <S,>(selector: (state: typeof spatial) => S) => selector(spatial),
  }
}

describe('GstarApp three-column shell', () => {
  it('shows only Host-classified stations and mounts DSH conversation after selection', () => {
    const openSite = vi.fn()
    render(<GstarApp {...props({ sites: [SITE], openSite })} />)

    expect(screen.getByLabelText('局点列表')).toBeTruthy()
    expect(screen.getByLabelText('局点空间资产地图')).toBeTruthy()
    expect(screen.getByLabelText('局点对话')).toBeTruthy()
    expect(screen.getByText(SITE.path)).toBeTruthy()
    expect(screen.queryByText('普通 DSH 工作区')).toBeNull()
    expect(screen.queryByTestId('dsh-conversation')).toBeNull()

    fireEvent.click(screen.getByText(SITE.title))
    expect(openSite).toHaveBeenCalledWith(SITE.workspaceId)
    expect(screen.getByTestId('dsh-conversation')).toBeTruthy()
  })

  it('creates a named station through the DSH directory flow and locates it automatically', async () => {
    const createSite = vi.fn().mockResolvedValue(SITE)
    const locateSpatial = vi.fn().mockResolvedValue(AOI_SPATIAL)
    const openSite = vi.fn()
    render(<GstarApp {...props({ createSite, locateSpatial, openSite })} />)

    fireEvent.click(screen.getByRole('button', { name: '新增局点' }))
    fireEvent.change(screen.getByPlaceholderText('例如：北京市朝阳区'), { target: { value: '广州局点' } })
    fireEvent.click(screen.getByRole('button', { name: '选择目录' }))
    fireEvent.click(screen.getByRole('button', { name: '选择此目录' }))
    fireEvent.click(screen.getByRole('button', { name: '创建并自动定位' }))

    await waitFor(() => {
      expect(createSite).toHaveBeenCalledWith({ path: '/data/stations/new-site', title: '广州局点' })
      expect(locateSpatial).toHaveBeenCalledWith({ workspaceId: SITE.workspaceId, query: '广州局点' })
    })
    expect(openSite).toHaveBeenCalledWith(SITE.workspaceId)
    expect(screen.queryByText('请在地球上点击局点所在位置')).toBeNull()
  })

  it('retries automatic name-based location without asking for a globe click', async () => {
    const locateSpatial = vi.fn().mockResolvedValue({
      workspaceId: SITE.workspaceId, aois: [], location: { longitude: 113.3, latitude: 23.1 },
    })
    render(<GstarApp {...props({
      sites: [SITE], spatial: [{ workspaceId: SITE.workspaceId, aois: [] }], locateSpatial,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: '重新自动定位' }))

    await waitFor(() => {
      expect(locateSpatial).toHaveBeenCalledWith({ workspaceId: SITE.workspaceId, query: SITE.title })
    })
    expect(screen.queryByText('请在地球上点击局点所在位置')).toBeNull()
  })

  it('shows AOI entity fields and provenance from the Host snapshot', () => {
    render(<GstarApp {...props({ sites: [SITE], spatial: [AOI_SPATIAL] })} />)
    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '选择 AOI' }))

    expect(screen.getByRole('complementary', { name: '天河道路 AOI 详情' })).toBeTruthy()
    expect(screen.getByText('体育西路')).toBeTruthy()
    expect(screen.getByText('OpenStreetMap Overpass')).toBeTruthy()
    expect(screen.getByText('ODbL-1.0')).toBeTruthy()
    expect(screen.getByText('sha256:test')).toBeTruthy()
  })

  it('keeps station creation disabled until the composed directory picker is ready', () => {
    render(<GstarApp {...props({ directoryAvailable: false })} />)
    expect(screen.getByRole('button', { name: '目录选择器加载中…' }).hasAttribute('disabled')).toBe(true)
  })
})
