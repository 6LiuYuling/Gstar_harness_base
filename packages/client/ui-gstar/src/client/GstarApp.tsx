import { useEffect, useMemo, useState } from 'react'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  HostObservable, PropsHooks, PropsRenderSlots, PropsRuntime, PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  DirectoryFlowOwnerProps, DirectoryFlowSlotName,
} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { GstarSiteCreateRequest, GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import type {
  GstarAoiSnapshot, GstarCoordinate, GstarSpatialPatchRequest, GstarSpatialSnapshot,
} from '@deepseek-ai/dsh-gstar-spatial/types'
import { CesiumGlobe } from './CesiumGlobe.tsx'
import type { GstarSiteListState } from './site-runtime.ts'
import type { GstarSpatialListState } from './spatial-runtime.ts'
import type { createGstarStore } from './stores.ts'
import css from './GstarApp.module.css'

type GstarRootChildSlot = DirectoryFlowSlotName | 'conversation' | 'details' | 'shell.overlay'

/** GSTAR business actions and live projections supplied by the registering Client plugin. */
export interface GstarAppInjected {
  /** Create or resolve a station through the Host `gstarSites` Remote. */
  createSite(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot>
  /** Open the station's reusable DSH conversation session. */
  openSite(workspaceId: WorkspaceId): void
  /** Persist a station location or pipeline-published AOI replacement. */
  patchSpatial(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot>
  /** Framework-bound Client hooks supplied by the registering plugin. */
  hooks: {
    /** Whether the composed DSH directory-picker currently occupies GSTAR's flow hole. */
    directoryFlow: HostObservable<boolean>
    /** Host-authoritative station projection. */
    sites: HostObservable<GstarSiteListState>
    /** Host-authoritative station locations, AOIs, entities, and provenance. */
    spatial: HostObservable<GstarSpatialListState>
  }
}

/** Props supplied by the root slot runtime, root store, and GSTAR Client plugin. */
export type GstarAppProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<GstarRootChildSlot>
  & PropsStore<ReturnType<typeof createGstarStore>>
  & Omit<GstarAppInjected, 'hooks'>
  & PropsHooks<GstarAppInjected['hooks']>

/** Render a scalar field without converting null into the string "undefined". */
function fieldValue(value: string | number | boolean | null): string {
  if (value === null) return '空值'
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

/** AOI details float over the map while the globe remains interactive around it. */
function AoiInspector({ aoi, onClose }: { readonly aoi: GstarAoiSnapshot; readonly onClose: () => void }) {
  return (
    <aside className={css.aoiInspector} aria-label={`${aoi.name} AOI 详情`}>
      <header>
        <div><span>{aoi.category}</span><h2>{aoi.name}</h2></div>
        <button type="button" onClick={onClose} aria-label="关闭 AOI 详情">×</button>
      </header>
      <div className={css.aoiScroll}>
        <section>
          <h3>实体字段</h3>
          {aoi.entities.length === 0 ? <p className={css.muted}>该 AOI 尚未发布实体。</p> : aoi.entities.map(entity => (
            <article className={css.entityCard} key={entity.id}>
              <div><strong>{entity.type}</strong><code>{entity.id}</code></div>
              <dl>
                {Object.entries(entity.fields).map(([name, value]) => (
                  <div key={name}><dt>{name}</dt><dd>{fieldValue(value)}</dd></div>
                ))}
              </dl>
            </article>
          ))}
        </section>
        <section>
          <h3>数据溯源</h3>
          {aoi.provenance.length === 0 ? <p className={css.muted}>该 AOI 尚未发布溯源记录。</p> : (
            <ul className={css.provenanceList}>
              {aoi.provenance.map(source => (
                <li key={`${source.sourceId}:${source.retrievedAt}`}>
                  <strong>{source.sourceName}</strong>
                  <span>来源：{source.sourceId}</span>
                  <span>获取时间：{new Date(source.retrievedAt).toLocaleString('zh-CN')}</span>
                  {source.license === undefined ? null : <span>许可：{source.license}</span>}
                  {source.checksum === undefined ? null : <code>{source.checksum}</code>}
                  {source.sourceUrl === undefined ? null : (
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">打开来源</a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  )
}

/**
 * Render the three-column GSTAR product shell over Host projections and standard DSH conversation slots.
 * @param props - Framework-bound root props.
 * @returns the GSTAR application shell.
 */
export function GstarApp({
  actions, createSite, openSite, patchSpatial, renderSlot,
  useDirectoryFlow, useSites, useSpatial, useStore,
}: GstarAppProps) {
  const view = useStore(state => state)
  const siteState = useSites(state => state)
  const spatialState = useSpatial(state => state)
  const directoryFlowAvailable = useDirectoryFlow(occupied => occupied)
  const [flowOpen, setFlowOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string>()
  const [spatialError, setSpatialError] = useState<string>()

  useEffect(() => {
    if (flowOpen && !directoryFlowAvailable) setFlowOpen(false)
  }, [directoryFlowAvailable, flowOpen])

  useEffect(() => {
    if (view.selectedSiteId !== undefined
      && !siteState.items.some(site => site.workspaceId === view.selectedSiteId)) {
      const first = siteState.items[0]
      if (first !== undefined) actions.selectSite(first.workspaceId)
    }
  }, [actions, siteState.items, view.selectedSiteId])

  const spatialById = useMemo(
    () => new Map(spatialState.items.map(item => [item.workspaceId, item])),
    [spatialState.items],
  )
  const selectedSite = siteState.items.find(site => site.workspaceId === view.selectedSiteId)
  const selectedSpatial = selectedSite === undefined ? undefined : spatialById.get(selectedSite.workspaceId)
  const selectedAoi = selectedSpatial?.aois.find(aoi => aoi.id === view.selectedAoiId)

  const chooseSite = (workspaceId: WorkspaceId) => {
    actions.selectSite(workspaceId)
    openSite(workspaceId)
  }

  const connectDirectory = async (path: string) => {
    setSubmitting(true)
    setCreateError(undefined)
    try {
      const site = await createSite({ path })
      actions.beginLocating(site.workspaceId)
      openSite(site.workspaceId)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
      setFlowOpen(false)
    }
  }

  const locateSite = (workspaceId: WorkspaceId, coordinate: GstarCoordinate) => {
    setSpatialError(undefined)
    void patchSpatial({ workspaceId, location: coordinate }).then(
      () => { actions.finishLocating() },
      (reason: unknown) => {
        setSpatialError(reason instanceof Error ? reason.message : String(reason))
      },
    )
  }

  const directoryFlowOwner: DirectoryFlowOwnerProps = {
    open: flowOpen,
    busy: submitting,
    onPicked: path => { void connectDirectory(path) },
    onCancel: () => { setFlowOpen(false) },
    onError: (message) => {
      setFlowOpen(false)
      setCreateError(message)
    },
  }
  let createActionLabel = '新增局点'
  if (!directoryFlowAvailable) createActionLabel = '目录选择器加载中…'
  if (flowOpen) createActionLabel = '选择目录中…'
  if (submitting) createActionLabel = '创建中…'

  return (
    <div className={css.app} data-left-collapsed={view.leftCollapsed ? '' : undefined}>
      <header className={css.topbar}>
        <div className={css.brand} aria-label="GSTAR Harness">
          <span className={css.mark}>G</span>
          <span><strong>GSTAR / HARNESS</strong><small>DSH 时空数据资产平台</small></span>
        </div>
        <div className={css.topStatus}>
          <span>GSTAR PROFILE</span>
          <strong>{siteState.items.length}</strong> 个局点
          <strong>{spatialState.items.reduce((sum, item) => sum + item.aois.length, 0)}</strong> 个 AOI
        </div>
      </header>

      <main className={css.columns}>
        <aside className={css.siteColumn} aria-label="局点列表">
          <div className={css.panelHeader}>
            <div><span>STATIONS</span><h1>局点列表</h1></div>
            <button
              type="button"
              aria-expanded={flowOpen}
              disabled={submitting || flowOpen || !directoryFlowAvailable}
              onClick={() => {
                setCreateError(undefined)
                setFlowOpen(true)
              }}
            >
              {createActionLabel}
            </button>
          </div>
          {renderSlot('conversation.hero.workspace.directoryFlow', directoryFlowOwner)}
          {createError === undefined ? null : <p className={css.inlineError} role="alert">局点创建失败：{createError}</p>}
          {siteState.phase === 'loading' ? <p className={css.empty}>正在同步局点…</p> : null}
          {siteState.phase === 'error' ? <p className={css.empty} role="alert">局点同步失败：{siteState.error}</p> : null}
          {siteState.phase === 'ready' && siteState.items.length === 0 ? (
            <p className={css.empty}>尚未创建局点。新增局点会使用 DSH 的标准目录选择器。</p>
          ) : null}
          <div className={css.siteList}>
            {siteState.items.map((site) => {
              const stationSpatial = spatialById.get(site.workspaceId)
              const selected = site.workspaceId === view.selectedSiteId
              return (
                <article className={css.siteCard} data-selected={selected ? '' : undefined} key={site.workspaceId}>
                  <button type="button" className={css.siteMain} onClick={() => { chooseSite(site.workspaceId) }}>
                    <span className={css.siteDot} data-located={stationSpatial?.location === undefined ? undefined : ''} />
                    <span className={css.siteCopy}>
                      <strong>{site.title}</strong>
                      <small title={site.path}>{site.path}</small>
                    </span>
                    <span className={css.siteCount}>{stationSpatial?.aois.length ?? 0} AOI</span>
                  </button>
                  {stationSpatial?.location === undefined ? (
                    <button
                      type="button"
                      className={css.locateButton}
                      onClick={() => {
                        actions.beginLocating(site.workspaceId)
                        openSite(site.workspaceId)
                      }}
                    >
                      在地球上定位
                    </button>
                  ) : null}
                </article>
              )
            })}
          </div>
        </aside>

        <section className={css.mapColumn} aria-label="局点空间资产地图">
          <CesiumGlobe
            sites={siteState.items}
            spatial={spatialState.items}
            {...(view.selectedSiteId === undefined ? {} : { selectedSiteId: view.selectedSiteId })}
            {...(view.selectedAoiId === undefined ? {} : { selectedAoiId: view.selectedAoiId })}
            {...(view.locatingSiteId === undefined ? {} : { locatingSiteId: view.locatingSiteId })}
            onSelectSite={chooseSite}
            onSelectAoi={(workspaceId, aoiId) => {
              if (workspaceId !== view.selectedSiteId) chooseSite(workspaceId)
              actions.selectAoi(aoiId)
            }}
            onLocate={locateSite}
          />
          <div className={css.mapTitle}>
            <span>CESIUM GLOBAL VIEW</span>
            <strong>{selectedSite?.title ?? '全球局点总览'}</strong>
            <small>{selectedSpatial?.aois.length ?? 0} 个已发布 AOI</small>
          </div>
          {view.locatingSiteId === undefined ? null : (
            <div className={css.locatingNotice} role="status">
              <span>定位模式</span>
              <strong>请在地球上点击局点所在位置</strong>
              <button type="button" onClick={() => { actions.finishLocating() }}>取消</button>
            </div>
          )}
          {spatialState.phase === 'error' ? (
            <p className={css.mapError} role="alert">空间数据同步失败：{spatialState.error}</p>
          ) : null}
          {spatialError === undefined ? null : <p className={css.mapError} role="alert">位置保存失败：{spatialError}</p>}
          {selectedAoi === undefined ? null : (
            <AoiInspector aoi={selectedAoi} onClose={() => { actions.closeAoi() }} />
          )}
          <div className={css.mapLegend}>
            <span><i data-kind="site" />局点</span>
            <span><i data-kind="aoi" />AOI</span>
            <span>点击局点缩放 · 点击 AOI 查看实体与溯源</span>
          </div>
        </section>

        <aside className={css.chatColumn} aria-label="局点对话">
          <header className={css.chatHeader}>
            <div><span>DSH AGENT</span><strong>局点智能对话</strong></div>
            <small>{selectedSite?.title ?? '未选择局点'}</small>
          </header>
          <div className={css.chatBody}>
            {selectedSite === undefined ? (
              <div className={css.chatEmpty}>
                <strong>选择一个局点开始对话</strong>
                <span>会话由标准 DSH Conversation 插件提供，并绑定到局点 Workspace。</span>
              </div>
            ) : renderSlot('conversation', {})}
            {view.detailsOpen ? <div className={css.toolDetails}>{renderSlot('details', {})}</div> : null}
          </div>
        </aside>
      </main>
      <div className={css.shellOverlay}>{renderSlot('shell.overlay', {})}</div>
    </div>
  )
}
