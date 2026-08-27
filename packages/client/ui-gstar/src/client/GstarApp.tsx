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
import type {
  GstarSiteCreateRequest, GstarSiteDeleteRequest, GstarSiteSnapshot,
} from '@deepseek-ai/dsh-gstar-site/types'
import type {
  GstarAoiSnapshot, GstarSpatialLocateRequest, GstarSpatialPatchRequest, GstarSpatialSnapshot,
} from '@deepseek-ai/dsh-gstar-spatial/types'
import { CesiumGlobe, type GstarMapMode } from './CesiumGlobe.tsx'
import type { GstarSiteListState } from './site-runtime.ts'
import type { GstarSpatialListState } from './spatial-runtime.ts'
import type { createGstarStore } from './stores.ts'
import css from './GstarApp.module.css'

type GstarRootChildSlot = DirectoryFlowSlotName | 'conversation' | 'details' | 'shell.overlay'

/** GSTAR business actions and live projections supplied by the registering Client plugin. */
export interface GstarAppInjected {
  /** Create or resolve a station through the Host `gstarSites` Remote. */
  createSite(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot>
  /** Remove GSTAR classification and station-owned assets while preserving the Workspace directory. */
  deleteSite(request: GstarSiteDeleteRequest): Promise<GstarSiteSnapshot>
  /** Open the station's reusable DSH conversation session. */
  openSite(workspaceId: WorkspaceId): void
  /** Persist a station location or pipeline-published AOI replacement. */
  patchSpatial(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot>
  /** Resolve the user-supplied station name on the Host and persist its marker. */
  locateSpatial(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot>
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
  actions, createSite, deleteSite, locateSpatial, openSite, renderSlot,
  useDirectoryFlow, useSites, useSpatial, useStore,
}: GstarAppProps) {
  const view = useStore(state => state)
  const siteState = useSites(state => state)
  const spatialState = useSpatial(state => state)
  const directoryFlowAvailable = useDirectoryFlow(occupied => occupied)
  const [createOpen, setCreateOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [stationName, setStationName] = useState('')
  const [stationPath, setStationPath] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string>()
  const [spatialError, setSpatialError] = useState<string>()
  const [deleteTarget, setDeleteTarget] = useState<GstarSiteSnapshot>()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()
  const [mapMode, setMapMode] = useState<GstarMapMode>('3d')

  useEffect(() => {
    if (flowOpen && !directoryFlowAvailable) setFlowOpen(false)
  }, [directoryFlowAvailable, flowOpen])

  useEffect(() => {
    if (view.selectedSiteId !== undefined
      && !siteState.items.some(site => site.workspaceId === view.selectedSiteId)) {
      const first = siteState.items[0]
      if (first === undefined) actions.clearSelection()
      else actions.selectSite(first.workspaceId)
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

  const createStation = async () => {
    const title = stationName.trim()
    if (title.length === 0) {
      setCreateError('请输入局点名称')
      return
    }
    if (stationPath === undefined) {
      setCreateError('请选择局点工作目录')
      return
    }
    setSubmitting(true)
    setCreateError(undefined)
    setSpatialError(undefined)
    try {
      const site = await createSite({ path: stationPath, title })
      actions.beginLocating(site.workspaceId)
      openSite(site.workspaceId)
      try {
        await locateSpatial({ workspaceId: site.workspaceId, query: title })
        setCreateOpen(false)
        setStationName('')
        setStationPath(undefined)
      } catch (error) {
        setCreateOpen(false)
        setStationName('')
        setStationPath(undefined)
        setSpatialError(`局点已创建，但自动定位失败：${error instanceof Error ? error.message : String(error)}`)
      } finally {
        actions.finishLocating()
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
      setFlowOpen(false)
    }
  }

  const locateSite = (site: GstarSiteSnapshot) => {
    setSpatialError(undefined)
    actions.beginLocating(site.workspaceId)
    openSite(site.workspaceId)
    void locateSpatial({ workspaceId: site.workspaceId, query: site.title }).then(
      () => { actions.finishLocating() },
      (reason: unknown) => {
        setSpatialError(reason instanceof Error ? reason.message : String(reason))
        actions.finishLocating()
      },
    )
  }

  const confirmDeleteSite = async () => {
    if (deleteTarget === undefined) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await deleteSite({ workspaceId: deleteTarget.workspaceId })
      if (view.selectedSiteId === deleteTarget.workspaceId) actions.clearSelection()
      setDeleteTarget(undefined)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error))
    } finally {
      setDeleting(false)
    }
  }

  const directoryFlowOwner: DirectoryFlowOwnerProps = {
    open: flowOpen,
    busy: submitting,
    onPicked: (path) => {
      setStationPath(path)
      setFlowOpen(false)
    },
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
  if (createOpen && !flowOpen && !submitting) createActionLabel = '取消新增'

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
              aria-expanded={createOpen}
              disabled={submitting || flowOpen || !directoryFlowAvailable}
              onClick={() => {
                setCreateError(undefined)
                setCreateOpen(open => !open)
              }}
            >
              {createActionLabel}
            </button>
          </div>
          {createOpen ? (
            <form
              className={css.createForm}
              onSubmit={(event) => {
                event.preventDefault()
                void createStation()
              }}
            >
              <label>
                <span>局点名称</span>
                <input
                  autoFocus
                  value={stationName}
                  placeholder="例如：北京市朝阳区"
                  onChange={(event) => { setStationName(event.currentTarget.value) }}
                />
              </label>
              <div className={css.directoryField}>
                <span title={stationPath}>{stationPath ?? '尚未选择工作目录'}</span>
                <button type="button" disabled={flowOpen || submitting} onClick={() => { setFlowOpen(true) }}>
                  选择目录
                </button>
              </div>
              <button type="submit" disabled={submitting || stationName.trim().length === 0 || stationPath === undefined}>
                {submitting ? '正在创建并定位…' : '创建并自动定位'}
              </button>
            </form>
          ) : null}
          {renderSlot('conversation.hero.workspace.directoryFlow', directoryFlowOwner)}
          {createError === undefined ? null : <p className={css.inlineError} role="alert">局点创建失败：{createError}</p>}
          {siteState.phase === 'loading' ? <p className={css.empty}>正在同步局点…</p> : null}
          {siteState.phase === 'error' ? <p className={css.empty} role="alert">局点同步失败：{siteState.error}</p> : null}
          {siteState.phase === 'ready' && siteState.items.length === 0 ? (
            <p className={css.empty}>尚未创建局点。输入名称并选择 DSH Workspace 目录后，系统会自动定位。</p>
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
                  <div className={css.siteActions}>
                    {stationSpatial?.location === undefined || stationSpatial.boundary === undefined ? (
                      <button
                        type="button"
                        className={css.locateButton}
                        disabled={view.locatingSiteId === site.workspaceId}
                        onClick={() => { locateSite(site) }}
                      >
                        {view.locatingSiteId === site.workspaceId
                          ? '正在自动定位…'
                          : stationSpatial?.location === undefined ? '重新自动定位' : '获取局点范围'}
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      className={css.deleteButton}
                      onClick={() => {
                        setDeleteError(undefined)
                        setDeleteTarget(site)
                      }}
                    >
                      删除
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </aside>

        <section className={css.mapColumn} aria-label="局点空间资产地图">
          <CesiumGlobe
            sites={siteState.items}
            spatial={spatialState.items}
            mode={mapMode}
            focusRevision={view.focusRevision}
            {...(view.selectedSiteId === undefined ? {} : { selectedSiteId: view.selectedSiteId })}
            {...(view.selectedAoiId === undefined ? {} : { selectedAoiId: view.selectedAoiId })}
            onSelectSite={chooseSite}
            onSelectAoi={(workspaceId, aoiId) => {
              if (workspaceId !== view.selectedSiteId) chooseSite(workspaceId)
              actions.selectAoi(aoiId)
            }}
          />
          <div
            className={css.mapTitle}
            data-with-mode-switch={selectedSite === undefined ? undefined : ''}
          >
            <span>CESIUM {mapMode.toUpperCase()} VIEW</span>
            <strong>{selectedSite?.title ?? '全球局点总览'}</strong>
            <small>
              {selectedSpatial?.aois.length ?? 0} 个已发布 AOI ·
              {selectedSpatial?.boundary === undefined ? ' 局点范围待获取' : ' 局点范围已标注'}
            </small>
          </div>
          {selectedSite === undefined ? null : (
            <div className={css.mapModeSwitch} role="group" aria-label="地图视图">
              <button
                type="button"
                aria-pressed={mapMode === '3d'}
                onClick={() => { setMapMode('3d') }}
              >
                3D
              </button>
              <button
                type="button"
                aria-pressed={mapMode === '2d'}
                onClick={() => { setMapMode('2d') }}
              >
                2D
              </button>
            </div>
          )}
          {view.locatingSiteId === undefined ? null : (
            <div className={css.locatingNotice} role="status">
              <span>自动定位</span>
              <strong>正在根据局点名称解析地理位置…</strong>
            </div>
          )}
          {spatialState.phase === 'error' ? (
            <p className={css.mapError} role="alert">空间数据同步失败：{spatialState.error}</p>
          ) : null}
          {spatialError === undefined ? null : <p className={css.mapError} role="alert">自动定位提示：{spatialError}</p>}
          {selectedAoi === undefined ? null : (
            <AoiInspector aoi={selectedAoi} onClose={() => { actions.closeAoi() }} />
          )}
          <div className={css.mapLegend}>
            <span><i data-kind="site" />局点</span>
            <span><i data-kind="aoi" />AOI</span>
            <span>点击局点缩放 · 点击 AOI 查看实体与溯源</span>
            <span>定位数据 © OpenStreetMap contributors / Nominatim / Photon</span>
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
      {deleteTarget === undefined ? null : (
        <div className={css.deleteBackdrop} role="presentation">
          <section
            className={css.deleteDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gstar-delete-title"
          >
            <span>DELETE STATION</span>
            <h2 id="gstar-delete-title">删除局点“{deleteTarget.title}”？</h2>
            <p>将移除 GSTAR 局点身份、位置、边界、AOI、实体与溯源数据。</p>
            <p>原工作目录和 DSH 会话日志不会删除，仍可在 <code>dsh web</code> 中作为普通工作区使用。</p>
            {deleteError === undefined ? null : <p className={css.deleteError} role="alert">删除失败：{deleteError}</p>}
            <div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setDeleteTarget(undefined) }}
              >
                取消
              </button>
              <button type="button" disabled={deleting} onClick={() => { void confirmDeleteSite() }}>
                {deleting ? '正在删除…' : '确认删除局点'}
              </button>
            </div>
          </section>
        </div>
      )}
      <div className={css.shellOverlay}>{renderSlot('shell.overlay', {})}</div>
    </div>
  )
}
