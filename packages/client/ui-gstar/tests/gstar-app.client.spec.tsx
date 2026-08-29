// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import type { GstarSpatialSnapshot } from '@deepseek-ai/dsh-gstar-spatial/types'
import { GstarApp, type GstarAppProps } from '../src/client/GstarApp.tsx'
import { createGstarStore } from '../src/client/stores.ts'

vi.mock('cesium', () => {
  class MockColor {
    public constructor(readonly value: string) {}
    public withAlpha(alpha: number) { return { alpha, value: this.value } }
    public static fromCssColorString(value: string) { return new MockColor(value) }
    public static readonly BLACK = new MockColor('black')
    public static readonly WHITE = new MockColor('white')
    public static readonly RED = new MockColor('red')
    public static readonly ORANGE = new MockColor('orange')
    public static readonly GOLD = new MockColor('gold')
    public static readonly CYAN = new MockColor('cyan')
    public static readonly HOTPINK = new MockColor('hotpink')
    public static readonly VIOLET = new MockColor('violet')
    public static readonly LIME = new MockColor('lime')
  }
  class MockViewer {
    public readonly entityItems: Array<Record<string, unknown>> = []
    public readonly flyCalls: unknown[][] = []
    public readonly morphs: string[] = []
    public pickResult: unknown
    public destroyed = false
    public readonly entities = {
      add: (input: Record<string, unknown>) => {
        const entity = { ...input }
        this.entityItems.push(entity)
        return entity
      },
      removeAll: () => { this.entityItems.length = 0 },
    }
    public readonly scene = {
      globe: { baseColor: undefined as unknown },
      canvas: {},
      mode: 3,
      pick: () => this.pickResult,
      requestRender: () => {},
      morphTo2D: () => { this.scene.mode = 2; this.morphs.push('2d') },
      morphTo3D: () => { this.scene.mode = 3; this.morphs.push('3d') },
    }
    public constructor() {
      if (mockState.viewerFailure !== undefined) throw mockState.viewerFailure
      mockState.viewers.push(this)
    }
    public flyTo(...args: unknown[]) { this.flyCalls.push(args); return Promise.resolve(true) }
    public isDestroyed() { return this.destroyed }
    public destroy() { this.destroyed = true }
  }
  class MockHandler {
    public action?: (movement: { position: unknown }) => void
    public destroyed = false
    public constructor() { mockState.handlers.push(this) }
    public setInputAction(action: (movement: { position: unknown }) => void) { this.action = action }
    public destroy() { this.destroyed = true }
  }
  const mockState: {
    readonly viewers: MockViewer[]
    readonly handlers: MockHandler[]
    viewerFailure: unknown
    reset(): void
  } = {
    viewers: [],
    handlers: [],
    viewerFailure: undefined,
    reset() {
      this.viewers.length = 0
      this.handlers.length = 0
      this.viewerFailure = undefined
    },
  }
  return {
    __mockState: mockState,
    ArcType: { GEODESIC: 'geodesic' },
    Cartesian2: class { public constructor(readonly x: number, readonly y: number) {} },
    Cartesian3: { fromDegrees: (...values: number[]) => values },
    Color: MockColor,
    Credit: class { public constructor(readonly value: string) {} },
    EllipsoidTerrainProvider: class { public readonly kind = 'ellipsoid' },
    HeadingPitchRange: class {
      public constructor(readonly heading: number, readonly pitch: number, readonly range: number) {}
    },
    ImageryLayer: class {
      public brightness = 1
      public contrast = 1
      public saturation = 1
      public gamma = 1
    },
    LabelStyle: { FILL_AND_OUTLINE: 'fill-and-outline' },
    PolygonHierarchy: class {
      public constructor(readonly positions: unknown[], readonly holes: unknown[] = []) {}
    },
    SceneMode: { SCENE2D: 2, SCENE3D: 3 },
    ScreenSpaceEventHandler: MockHandler,
    ScreenSpaceEventType: { LEFT_CLICK: 'left-click' },
    UrlTemplateImageryProvider: class { public constructor(readonly options: unknown) {} },
    Viewer: MockViewer,
    buildModuleUrl: { setBaseUrl: () => {} },
  }
})

vi.mock('../src/client/CesiumGlobe.tsx', () => ({
  CesiumGlobe: (props: {
    readonly sites: readonly GstarSiteSnapshot[]
    readonly spatial: readonly GstarSpatialSnapshot[]
    readonly mode: '2d' | '3d'
    readonly visibleAoiCategories: readonly string[]
    readonly selectedSiteId?: string
    readonly onSelectSite: (id: never) => void
    readonly onSelectAoi: (workspaceId: never, aoiId: string) => void
  }) => (
    <div
      aria-label="GSTAR Cesium 地图"
      data-map-mode={props.mode}
      data-selected-site={props.selectedSiteId ?? ''}
      data-visible-categories={props.visibleAoiCategories.join(',')}
    >
      {props.sites.map(site => (
        <button key={site.workspaceId} type="button" onClick={() => { props.onSelectSite(site.workspaceId as never) }}>
          地图局点：{site.title}
        </button>
      ))}
      {props.selectedSiteId === undefined ? null : (
        <>
          <button type="button" onClick={() => { props.onSelectAoi(props.selectedSiteId as never, 'aoi-1') }}>
            选择 AOI
          </button>
          <button type="button" onClick={() => { props.onSelectAoi('workspace-2' as never, 'aoi-1') }}>
            选择其他局点 AOI
          </button>
        </>
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

const SECOND_SITE: GstarSiteSnapshot = {
  ...SITE,
  workspaceId: 'workspace-2' as never,
  path: '/data/stations/shenzhen',
  title: '深圳局点',
}

const AOI_SPATIAL: GstarSpatialSnapshot = {
  workspaceId: SITE.workspaceId,
  location: { longitude: 113.3, latitude: 23.1 },
  aois: [{
    id: 'aoi-1',
    name: '天河道路',
    category: '政',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        { longitude: 113, latitude: 23 },
        { longitude: 114, latitude: 23 },
        { longitude: 114, latitude: 24 },
        { longitude: 113, latitude: 23 },
      ]],
    },
    entities: [{
      id: 'road-1', type: 'road',
      fields: { name: '体育西路', lanes: 4, verified: true, rejected: false, nullable: null },
    }],
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

const SOURCES = [{
  id: 'osm-overpass',
  name: 'OpenStreetMap / Overpass API',
  publisher: 'OpenStreetMap contributors',
  url: 'https://overpass-api.de/api/interpreter',
  categories: ['政', '企', '金融', '教育', '医疗', '商场', '居民区'] as const,
  accessMode: 'direct' as const,
  license: 'ODbL-1.0',
}, {
  id: 'national-enterprise-credit',
  name: '国家企业信用信息公示系统',
  publisher: '国家市场监督管理总局',
  url: 'https://www.gsxt.gov.cn/index.html',
  categories: ['企'] as const,
  accessMode: 'reference' as const,
}]

function storeHook<T>(store: { subscribe(listener: () => void): () => void; getSnapshot(): T }) {
  return function useStore<S>(selector: (state: T) => S): S {
    return selector(useSyncExternalStore(
      listener => store.subscribe(listener),
      () => store.getSnapshot(),
    ))
  }
}

function props(options: {
  readonly sites?: readonly GstarSiteSnapshot[] | (() => readonly GstarSiteSnapshot[])
  readonly spatial?: readonly GstarSpatialSnapshot[] | (() => readonly GstarSpatialSnapshot[])
  readonly createSite?: GstarAppProps['createSite']
  readonly deleteSite?: GstarAppProps['deleteSite']
  readonly patchSpatial?: GstarAppProps['patchSpatial']
  readonly locateSpatial?: GstarAppProps['locateSpatial']
  readonly refreshAois?: GstarAppProps['refreshAois']
  readonly openSite?: GstarAppProps['openSite']
  readonly directoryAvailable?: boolean | (() => boolean)
  readonly sourceError?: string
  readonly sitePhase?: 'loading' | 'ready' | 'error'
  readonly siteError?: string
  readonly spatialPhase?: 'loading' | 'ready' | 'error'
  readonly spatialError?: string
  readonly detailsOpen?: boolean
  readonly leftCollapsed?: boolean
} = {}): GstarAppProps {
  const store = createGstarStore().create()
  if (options.detailsOpen === true) store.actions.openDetails()
  if (options.leftCollapsed === true) store.actions.toggleSidebar()
  const siteItems = () => typeof options.sites === 'function' ? options.sites() : options.sites ?? []
  const spatialItems = () => typeof options.spatial === 'function' ? options.spatial() : options.spatial ?? []
  const sources = options.sourceError === undefined
    ? { items: SOURCES, phase: 'ready' as const }
    : { items: SOURCES, phase: 'error' as const, error: options.sourceError }
  const renderSlot: GstarAppProps['renderSlot'] = (name, owner) => {
    if (name === 'conversation.hero.workspace.directoryFlow') {
      const flow = owner as unknown as DirectoryFlowOwnerProps
      return flow.open
        ? <div>
          <button type="button" onClick={() => { flow.onPicked('/data/stations/new-site') }}>选择此目录</button>
          <button type="button" onClick={() => { flow.onCancel() }}>取消目录选择</button>
          <button type="button" onClick={() => { flow.onError('directory failed') }}>目录选择失败</button>
        </div>
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
    deleteSite: options.deleteSite ?? vi.fn(),
    patchSpatial: options.patchSpatial ?? vi.fn(),
    locateSpatial: options.locateSpatial ?? vi.fn(),
    refreshAois: options.refreshAois ?? vi.fn().mockResolvedValue(AOI_SPATIAL),
    openSite: options.openSite ?? vi.fn(),
    renderSlot,
    useSessions: (() => undefined) as GstarAppProps['useSessions'],
    useWorkspaces: (() => undefined) as GstarAppProps['useWorkspaces'],
    useDirectoryFlow: <S,>(selector: (available: boolean) => S) => selector(
      typeof options.directoryAvailable === 'function'
        ? options.directoryAvailable()
        : options.directoryAvailable ?? true,
    ),
    useSites: selector => selector({
      items: siteItems(),
      phase: options.sitePhase ?? 'ready',
      ...(options.siteError === undefined ? {} : { error: options.siteError }),
    }),
    useSpatial: selector => selector({
      items: spatialItems(),
      phase: options.spatialPhase ?? 'ready',
      ...(options.spatialError === undefined ? {} : { error: options.spatialError }),
    }),
    useSources: <S,>(selector: (state: typeof sources) => S) => selector(sources),
  }
}

describe('GstarApp three-column shell', () => {
  it('opens and closes the shared DSH details state', () => {
    const store = createGstarStore().create()
    store.actions.openDetails()
    expect(store.getSnapshot().detailsOpen).toBe(true)
    store.actions.closeDetails()
    expect(store.getSnapshot().detailsOpen).toBe(false)
  })

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

  it('falls back to the first station when the selected Host station disappears', async () => {
    let sites: readonly GstarSiteSnapshot[] = [SITE, SECOND_SITE]
    const subject = props({ sites: () => sites })
    const { rerender } = render(<GstarApp {...subject} />)

    fireEvent.click(screen.getByText(SECOND_SITE.title))
    expect(screen.getByLabelText('GSTAR Cesium 地图').getAttribute('data-selected-site'))
      .toBe(SECOND_SITE.workspaceId)

    sites = [SITE]
    rerender(<GstarApp {...subject} />)
    await waitFor(() => {
      expect(screen.getByLabelText('GSTAR Cesium 地图').getAttribute('data-selected-site'))
        .toBe(SITE.workspaceId)
    })
  })

  it('opens an AOI station selected from another map workspace', () => {
    const openSite = vi.fn()
    render(<GstarApp {...props({ sites: [SITE, SECOND_SITE], spatial: [AOI_SPATIAL], openSite })} />)

    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '选择其他局点 AOI' }))

    expect(openSite).toHaveBeenLastCalledWith(SECOND_SITE.workspaceId)
    expect(screen.getByLabelText('GSTAR Cesium 地图').getAttribute('data-selected-site'))
      .toBe(SECOND_SITE.workspaceId)
  })

  it('switches a selected station between the Cesium 3D and 2D projections', () => {
    render(<GstarApp {...props({ sites: [SITE], spatial: [AOI_SPATIAL] })} />)

    expect(screen.queryByRole('group', { name: '地图视图' })).toBeNull()
    fireEvent.click(screen.getByText(SITE.title))

    const map = screen.getByLabelText('GSTAR Cesium 地图')
    const threeDimensional = screen.getByRole('button', { name: '3D' })
    const twoDimensional = screen.getByRole('button', { name: '2D' })
    expect(map.getAttribute('data-map-mode')).toBe('3d')
    expect(threeDimensional.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(twoDimensional)
    expect(map.getAttribute('data-map-mode')).toBe('2d')
    expect(twoDimensional.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('CESIUM 2D VIEW')).toBeTruthy()
    fireEvent.click(threeDimensional)
    expect(map.getAttribute('data-map-mode')).toBe('3d')
  })

  it('filters the seven AOI map categories and exposes direct versus official sources', () => {
    render(<GstarApp {...props({ sites: [SITE], spatial: [AOI_SPATIAL] })} />)
    fireEvent.click(screen.getByText(SITE.title))

    const map = screen.getByLabelText('GSTAR Cesium 地图')
    expect(screen.getByRole('group', { name: 'AOI 类型筛选' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^全选1$/u }).getAttribute('aria-pressed')).toBe('true')
    expect(map.getAttribute('data-visible-categories')).toContain('政')

    fireEvent.click(screen.getByRole('button', { name: '选择 AOI' }))
    expect(screen.getByRole('complementary', { name: '天河道路 AOI 详情' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^政1$/u }))
    expect(map.getAttribute('data-visible-categories')).not.toContain('政')
    expect(screen.queryByRole('complementary', { name: '天河道路 AOI 详情' })).toBeNull()
    expect(screen.getByText('0 / 1 个 AOI 显示 · 局点范围待获取')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^政1$/u }))
    expect(map.getAttribute('data-visible-categories')).toContain('政')

    fireEvent.click(screen.getByRole('button', { name: /^全选1$/u }))
    expect(map.getAttribute('data-visible-categories')).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /^全选1$/u }))
    expect(map.getAttribute('data-visible-categories')).toContain('居民区')

    fireEvent.click(screen.getByRole('button', { name: '数据源 2' }))
    expect(screen.getByRole('complementary', { name: '公开数据源' })).toBeTruthy()
    expect(screen.getByText('OpenStreetMap / Overpass API')).toBeTruthy()
    expect(screen.getByText('国家企业信用信息公示系统')).toBeTruthy()
    expect(screen.getByText('直接采集')).toBeTruthy()
    expect(screen.getByText('官方校验')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭公开数据源' }))
    expect(screen.queryByRole('complementary', { name: '公开数据源' })).toBeNull()
  })

  it('confirms station deletion and preserves the generic Workspace contract in its copy', async () => {
    const deleteSite = vi.fn().mockResolvedValue(SITE)
    render(<GstarApp {...props({ sites: [SITE], deleteSite })} />)

    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.getByRole('dialog', { name: `删除局点“${SITE.title}”？` })).toBeTruthy()
    expect(screen.getByText(/原工作目录和 DSH 会话日志不会删除/u)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认删除局点' }))

    await waitFor(() => {
      expect(deleteSite).toHaveBeenCalledWith({ workspaceId: SITE.workspaceId })
    })
  })

  it('deletes an unselected station without changing the current map selection', async () => {
    const deleteSite = vi.fn().mockResolvedValue(SITE)
    render(<GstarApp {...props({ sites: [SITE], deleteSite })} />)

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除局点' }))

    await waitFor(() => {
      expect(deleteSite).toHaveBeenCalledWith({ workspaceId: SITE.workspaceId })
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('cancels deletion and reports a Host deletion failure', async () => {
    const deleteSite = vi.fn()
      .mockRejectedValueOnce('membership delete failed')
      .mockRejectedValueOnce(new Error('membership error'))
    render(<GstarApp {...props({ sites: [SITE], deleteSite })} />)

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除局点' }))
    await waitFor(() => {
      expect(screen.getByText('删除失败：membership delete failed')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '确认删除局点' }))
    await waitFor(() => {
      expect(screen.getByText('删除失败：membership error')).toBeTruthy()
    })
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

  it('validates station creation, reports create failure, and keeps a created station after locate failure', async () => {
    const createSite = vi.fn()
      .mockRejectedValueOnce(new Error('create failed'))
      .mockRejectedValueOnce('create string failed')
      .mockResolvedValueOnce(SITE)
    const locateSpatial = vi.fn().mockRejectedValue('geocoder unavailable')
    render(<GstarApp {...props({ createSite, locateSpatial })} />)

    fireEvent.click(screen.getByRole('button', { name: '新增局点' }))
    const nameInput = screen.getByPlaceholderText('例如：北京市朝阳区')
    const createForm = nameInput.closest('form')
    expect(createForm).not.toBeNull()
    fireEvent.submit(createForm as HTMLFormElement)
    expect(screen.getByText('局点创建失败：请输入局点名称')).toBeTruthy()
    fireEvent.change(nameInput, { target: { value: '广州局点' } })
    fireEvent.submit(createForm as HTMLFormElement)
    expect(screen.getByText('局点创建失败：请选择局点工作目录')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '选择目录' }))
    fireEvent.click(screen.getByRole('button', { name: '选择此目录' }))
    fireEvent.click(screen.getByRole('button', { name: '创建并自动定位' }))
    await waitFor(() => {
      expect(screen.getByText('局点创建失败：create failed')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '创建并自动定位' }))
    await waitFor(() => {
      expect(screen.getByText('局点创建失败：create string failed')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '创建并自动定位' }))
    await waitFor(() => {
      expect(screen.getByText('自动定位提示：局点已创建，但自动定位失败：geocoder unavailable')).toBeTruthy()
    })
  })

  it('reports an Error raised while locating a newly created station', async () => {
    const createSite = vi.fn().mockResolvedValue(SITE)
    const locateSpatial = vi.fn().mockRejectedValue(new Error('geocoder error'))
    render(<GstarApp {...props({ createSite, locateSpatial })} />)

    fireEvent.click(screen.getByRole('button', { name: '新增局点' }))
    fireEvent.change(screen.getByPlaceholderText('例如：北京市朝阳区'), { target: { value: SITE.title } })
    fireEvent.click(screen.getByRole('button', { name: '选择目录' }))
    fireEvent.click(screen.getByRole('button', { name: '选择此目录' }))
    fireEvent.click(screen.getByRole('button', { name: '创建并自动定位' }))

    await waitFor(() => {
      expect(screen.getByText('自动定位提示：局点已创建，但自动定位失败：geocoder error')).toBeTruthy()
    })
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

  it('reports a failed automatic location retry', async () => {
    const locateSpatial = vi.fn()
      .mockRejectedValueOnce(new Error('geocoder retry failed'))
      .mockRejectedValueOnce('geocoder retry string')
    render(<GstarApp {...props({
      sites: [SITE], spatial: [{ workspaceId: SITE.workspaceId, aois: [] }], locateSpatial,
    })} />)

    fireEvent.click(screen.getByRole('button', { name: '重新自动定位' }))
    await waitFor(() => {
      expect(screen.getByText('自动定位提示：geocoder retry failed')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '重新自动定位' }))
    await waitFor(() => {
      expect(screen.getByText('自动定位提示：geocoder retry string')).toBeTruthy()
    })
  })

  it('loads OpenStreetMap AOIs when a located station is opened without a publication', async () => {
    const refreshAois = vi.fn().mockResolvedValue(AOI_SPATIAL)
    render(<GstarApp {...props({
      sites: [SITE],
      spatial: [{ workspaceId: SITE.workspaceId, aois: [], location: { longitude: 113.3, latitude: 23.1 } }],
      refreshAois,
    })} />)

    fireEvent.click(screen.getByText(SITE.title))
    await waitFor(() => {
      expect(refreshAois).toHaveBeenCalledWith({ workspaceId: SITE.workspaceId })
    })
  })

  it('reports a manual OpenStreetMap refresh failure and a source-catalog failure', async () => {
    const refreshAois = vi.fn()
      .mockRejectedValueOnce('Overpass unavailable')
      .mockRejectedValueOnce(new Error('Overpass error'))
    render(<GstarApp {...props({
      sites: [SITE], spatial: [AOI_SPATIAL], refreshAois, sourceError: 'catalog unavailable',
    })} />)

    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '更新 OSM AOI' }))
    await waitFor(() => {
      expect(screen.getByText('OSM AOI 同步失败：Overpass unavailable')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: '更新 OSM AOI' }))
    await waitFor(() => {
      expect(screen.getByText('OSM AOI 同步失败：Overpass error')).toBeTruthy()
    })
    expect(screen.getByText('公开数据源同步失败：catalog unavailable')).toBeTruthy()
  })

  it('keeps a newer AOI refresh active when an earlier station refresh finishes first', async () => {
    let resolveFirst!: (value: GstarSpatialSnapshot) => void
    let resolveSecond!: (value: GstarSpatialSnapshot) => void
    const refreshAois = vi.fn()
      .mockImplementationOnce(() => new Promise<GstarSpatialSnapshot>((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise<GstarSpatialSnapshot>((resolve) => { resolveSecond = resolve }))
    const secondSpatial = { ...AOI_SPATIAL, workspaceId: SECOND_SITE.workspaceId }
    render(<GstarApp {...props({
      sites: [SITE, SECOND_SITE], spatial: [AOI_SPATIAL, secondSpatial], refreshAois,
    })} />)

    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '更新 OSM AOI' }))
    fireEvent.click(screen.getByText(SECOND_SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '更新 OSM AOI' }))

    resolveFirst(AOI_SPATIAL)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '同步 OSM…' })).toBeTruthy()
    })
    resolveSecond(secondSpatial)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '更新 OSM AOI' })).toBeTruthy()
    })
  })

  it('shows AOI entity fields and provenance from the Host snapshot', () => {
    render(<GstarApp {...props({ sites: [SITE], spatial: [AOI_SPATIAL] })} />)
    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '选择 AOI' }))

    expect(screen.getByRole('complementary', { name: '天河道路 AOI 详情' })).toBeTruthy()
    expect(screen.getByText('体育西路')).toBeTruthy()
    expect(screen.getByText('OpenStreetMap Overpass')).toBeTruthy()
    expect(screen.getByText(/ODbL-1.0/u)).toBeTruthy()
    expect(screen.getByText('sha256:test')).toBeTruthy()
    expect(screen.getByText('空值')).toBeTruthy()
    expect(screen.getByText('否')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭 AOI 详情' }))
    expect(screen.queryByRole('complementary', { name: '天河道路 AOI 详情' })).toBeNull()
  })

  it('explains when an AOI has no entities or provenance', () => {
    const emptyAoiSpatial: GstarSpatialSnapshot = {
      ...AOI_SPATIAL,
      aois: [{ ...AOI_SPATIAL.aois[0]!, entities: [], provenance: [] }],
    }
    render(<GstarApp {...props({ sites: [SITE], spatial: [emptyAoiSpatial] })} />)
    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '选择 AOI' }))

    expect(screen.getByText('该 AOI 尚未发布实体。')).toBeTruthy()
    expect(screen.getByText('该 AOI 尚未发布溯源记录。')).toBeTruthy()
  })

  it('renders provenance records whose optional metadata is unavailable', () => {
    const minimalProvenance: GstarSpatialSnapshot = {
      ...AOI_SPATIAL,
      aois: [{
        ...AOI_SPATIAL.aois[0]!,
        provenance: [{
          sourceId: 'official-reference',
          sourceName: '官方参考源',
          retrievedAt: '2026-08-21T08:00:00.000Z',
        }],
      }],
    }
    render(<GstarApp {...props({ sites: [SITE], spatial: [minimalProvenance] })} />)
    fireEvent.click(screen.getByText(SITE.title))
    fireEvent.click(screen.getByRole('button', { name: '选择 AOI' }))

    expect(screen.getByText('官方参考源')).toBeTruthy()
    expect(screen.queryByText(/^许可：/u)).toBeNull()
    expect(screen.queryByRole('link', { name: '打开来源' })).toBeNull()
  })

  it('renders loading and error states, a bounded station, shell details, and collapsed navigation', () => {
    const loading = render(<GstarApp {...props({ sitePhase: 'loading' })} />)
    expect(screen.getByText('正在同步局点…')).toBeTruthy()
    loading.unmount()

    const boundedSpatial: GstarSpatialSnapshot = {
      ...AOI_SPATIAL,
      boundary: AOI_SPATIAL.aois[0]!.geometry,
    }
    const { container } = render(<GstarApp {...props({
      sites: [SITE],
      spatial: [boundedSpatial],
      sitePhase: 'error',
      siteError: 'site unavailable',
      spatialPhase: 'error',
      spatialError: 'spatial unavailable',
      detailsOpen: true,
      leftCollapsed: true,
    })} />)

    expect(screen.getByText('局点同步失败：site unavailable')).toBeTruthy()
    expect(screen.getByText('空间数据同步失败：spatial unavailable')).toBeTruthy()
    expect(screen.getByTestId('dsh-details')).toBeTruthy()
    expect(container.firstElementChild?.hasAttribute('data-left-collapsed')).toBe(true)
    fireEvent.click(screen.getByText(SITE.title))
    expect(screen.getByText(/局点范围已标注/u)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '获取局点范围' })).toBeNull()
  })

  it('handles directory-picker cancellation, failure, and availability loss', async () => {
    let directoryAvailable = true
    const subject = props({ directoryAvailable: () => directoryAvailable })
    const { rerender } = render(<GstarApp {...subject} />)

    fireEvent.click(screen.getByRole('button', { name: '新增局点' }))
    fireEvent.click(screen.getByRole('button', { name: '选择目录' }))
    fireEvent.click(screen.getByRole('button', { name: '目录选择失败' }))
    expect(screen.getByText('局点创建失败：directory failed')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '选择目录' }))
    fireEvent.click(screen.getByRole('button', { name: '取消目录选择' }))
    expect(screen.queryByRole('button', { name: '取消目录选择' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '选择目录' }))
    directoryAvailable = false
    rerender(<GstarApp {...subject} />)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '取消目录选择' })).toBeNull()
      expect(screen.getByRole('button', { name: '取消新增' }).hasAttribute('disabled')).toBe(true)
    })
  })

  it('filters and colors AOIs inside the real Cesium projection and preserves map picks', async () => {
    const { CesiumGlobe } = await vi.importActual<typeof import('../src/client/CesiumGlobe.tsx')>(
      '../src/client/CesiumGlobe.tsx',
    )
    const { __mockState } = await import('cesium') as unknown as {
      readonly __mockState: {
        readonly viewers: Array<{
          readonly entityItems: Array<{
            readonly id?: string
            readonly polygon?: {
              readonly height?: number
              readonly material?: { readonly alpha?: number }
              readonly outlineWidth?: number
            }
          }>
          readonly flyCalls: unknown[][]
          readonly morphs: string[]
          pickResult: unknown
          destroyed: boolean
        }>
        readonly handlers: Array<{
          readonly action?: (movement: { position: unknown }) => void
          destroyed: boolean
        }>
        viewerFailure: unknown
        reset(): void
      }
    }
    __mockState.reset()
    const categories = ['政', '企', '金融', '教育', '医疗', '商场', '居民区'] as const
    const baseGeometry = AOI_SPATIAL.aois[0]!.geometry
    if (baseGeometry.type !== 'Polygon') throw new Error('AOI test fixture must be a Polygon')
    const hole = [
      { longitude: 113.2, latitude: 23.2 },
      { longitude: 113.3, latitude: 23.2 },
      { longitude: 113.2, latitude: 23.2 },
    ]
    const spatial: GstarSpatialSnapshot = {
      ...AOI_SPATIAL,
      boundary: baseGeometry,
      aois: categories.map((category, index) => ({
        ...AOI_SPATIAL.aois[0]!,
        id: `aoi-${String(index)}`,
        name: `${category} AOI`,
        category,
        geometry: index === 0
          ? { type: 'Polygon', coordinates: [...baseGeometry.coordinates, hole] }
          : index === 1
            ? { type: 'MultiPolygon', coordinates: [baseGeometry.coordinates] }
            : baseGeometry,
      })),
    }
    const secondSpatial: GstarSpatialSnapshot = {
      workspaceId: SECOND_SITE.workspaceId,
      location: { longitude: 114.1, latitude: 22.5 },
      aois: [],
    }
    const unlocatedSite: GstarSiteSnapshot = {
      ...SECOND_SITE,
      workspaceId: 'workspace-3' as never,
      title: '未定位局点',
    }
    const onSelectSite = vi.fn()
    const onSelectAoi = vi.fn()
    const base = {
      sites: [SITE, SECOND_SITE, unlocatedSite], spatial: [spatial, secondSpatial],
      selectedSiteId: SITE.workspaceId, selectedAoiId: 'aoi-0',
      focusRevision: 1, onSelectSite, onSelectAoi,
    }
    const { rerender, unmount } = render(
      <CesiumGlobe {...base} mode="3d" visibleAoiCategories={categories} />,
    )

    await waitFor(() => {
      expect(__mockState.viewers[0]?.entityItems.filter(entity => entity.id?.startsWith('gstar-aoi-')))
        .toHaveLength(categories.length)
    })
    const viewer = __mockState.viewers[0]!
    const renderedAois = viewer.entityItems.filter(entity => entity.id?.startsWith('gstar-aoi-'))
    expect(renderedAois.every(entity => entity.polygon?.height === 24)).toBe(true)
    expect(renderedAois[0]?.polygon).toMatchObject({
      material: { alpha: 0.62 },
      outlineWidth: 4,
    })
    expect(renderedAois[1]?.polygon).toMatchObject({
      material: { alpha: 0.42 },
      outlineWidth: 2,
    })
    const handler = __mockState.handlers[0]!
    viewer.pickResult = { id: viewer.entityItems.find(entity => entity.id === 'gstar-site-0') }
    handler.action?.({ position: {} })
    expect(onSelectSite).toHaveBeenCalledWith(SITE.workspaceId)
    viewer.pickResult = { id: viewer.entityItems.find(entity => entity.id === 'gstar-aoi-0-0') }
    handler.action?.({ position: {} })
    expect(onSelectAoi).toHaveBeenCalledWith(SITE.workspaceId, 'aoi-0')
    viewer.pickResult = undefined
    handler.action?.({ position: {} })
    expect(onSelectSite).toHaveBeenCalledTimes(1)

    rerender(<CesiumGlobe {...base} mode="2d" visibleAoiCategories={['企']} />)
    await waitFor(() => {
      expect(viewer.entityItems.filter(entity => entity.id?.startsWith('gstar-aoi-'))).toHaveLength(1)
      expect(viewer.morphs).toContain('2d')
    })
    expect(viewer.flyCalls.length).toBeGreaterThan(0)

    rerender(<CesiumGlobe {...base} mode="3d" visibleAoiCategories={['企']} />)
    await waitFor(() => { expect(viewer.morphs).toContain('3d') })
    rerender(<CesiumGlobe
      sites={base.sites}
      spatial={base.spatial}
      mode="3d"
      visibleAoiCategories={[]}
      focusRevision={2}
      onSelectSite={onSelectSite}
      onSelectAoi={onSelectAoi}
    />)
    await waitFor(() => {
      expect(viewer.entityItems.filter(entity => entity.id?.startsWith('gstar-aoi-'))).toHaveLength(0)
    })
    rerender(<CesiumGlobe
      sites={base.sites}
      spatial={base.spatial}
      mode="3d"
      visibleAoiCategories={[]}
      selectedSiteId={SECOND_SITE.workspaceId}
      focusRevision={3}
      onSelectSite={onSelectSite}
      onSelectAoi={onSelectAoi}
    />)
    await waitFor(() => {
      expect(viewer.flyCalls.at(-1)?.[0]).toHaveLength(1)
    })
    const multiBoundary: GstarSpatialSnapshot = {
      ...spatial,
      boundary: { type: 'MultiPolygon', coordinates: [baseGeometry.coordinates] },
    }
    rerender(<CesiumGlobe
      sites={base.sites}
      spatial={[multiBoundary, secondSpatial]}
      mode="3d"
      visibleAoiCategories={[]}
      selectedSiteId={SITE.workspaceId}
      focusRevision={4}
      onSelectSite={onSelectSite}
      onSelectAoi={onSelectAoi}
    />)
    await waitFor(() => {
      expect(viewer.entityItems.some(entity => entity.id === 'gstar-site-boundary-fill-0')).toBe(true)
    })

    unmount()
    expect(viewer.destroyed).toBe(true)
    expect(handler.destroyed).toBe(true)
  })

  it('surfaces Cesium initialization errors and reuses an existing widget stylesheet', async () => {
    const { CesiumGlobe } = await vi.importActual<typeof import('../src/client/CesiumGlobe.tsx')>(
      '../src/client/CesiumGlobe.tsx',
    )
    const { __mockState } = await import('cesium') as unknown as {
      readonly __mockState: {
        readonly viewers: Array<{ destroyed: boolean }>
        viewerFailure: unknown
        reset(): void
      }
    }
    const renderFailure = async (reason: unknown, message: string) => {
      __mockState.reset()
      __mockState.viewerFailure = reason
      const result = render(<CesiumGlobe
        sites={[]}
        spatial={[]}
        mode="3d"
        visibleAoiCategories={[]}
        focusRevision={0}
        onSelectSite={vi.fn()}
        onSelectAoi={vi.fn()}
      />)
      await waitFor(() => { expect(screen.getByText(`Cesium 加载失败：${message}`)).toBeTruthy() })
      result.unmount()
    }

    await renderFailure(new Error('viewer failed'), 'viewer failed')
    const link = document.createElement('link')
    link.dataset.gstarCesium = '/gstar/cesium/Widgets/widgets.css'
    document.head.append(link)
    await renderFailure('viewer string failure', 'viewer string failure')
    link.remove()

    __mockState.reset()
    const style = vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: () => '#123456',
    }) as unknown as CSSStyleDeclaration)
    const mounted = render(<CesiumGlobe
      sites={[]}
      spatial={[]}
      mode="3d"
      visibleAoiCategories={[]}
      focusRevision={0}
      onSelectSite={vi.fn()}
      onSelectAoi={vi.fn()}
    />)
    await waitFor(() => { expect(__mockState.viewers).toHaveLength(1) })
    __mockState.viewers[0]!.destroyed = true
    mounted.unmount()
    style.mockRestore()
  })

  it('keeps station creation disabled until the composed directory picker is ready', () => {
    render(<GstarApp {...props({ directoryAvailable: false })} />)
    expect(screen.getByRole('button', { name: '目录选择器加载中…' }).hasAttribute('disabled')).toBe(true)
  })
})
