import { useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { GstarSiteCreateRequest, GstarSiteSnapshot } from '@deepseek-ai/dsh-gstar-site/types'
import css from './GstarApp.module.css'
import type { GstarSiteListState } from './site-runtime.ts'

type Section = 'workspaces' | 'sources' | 'gates' | 'pipelines'

const NAVIGATION: readonly { id: Section; label: string }[] = [
  { id: 'workspaces', label: '区域资产' },
  { id: 'sources', label: '数据源插件' },
  { id: 'gates', label: '质量门禁' },
  { id: 'pipelines', label: '数据流水线' },
]

/** GSTAR business actions supplied by the registering Client plugin. */
export interface GstarAppInjected {
  /** Create or resolve a station through the Host `gstarSites` Remote. */
  createSite(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot>
  /** Host-authoritative station projection owned by the GSTAR browser runtime. */
  sites: SnapshotStore<GstarSiteListState>
}

/** Props supplied by the root slot runtime and the GSTAR Client plugin. */
export type GstarAppProps = PropsRuntime<'root'> & GstarAppInjected

/**
 * Render the GSTAR root projection from Host-classified station snapshots.
 * @param props - Framework-bound root runtime hooks.
 * @returns the GSTAR application shell.
 */
export function GstarApp({ createSite, sites }: GstarAppProps) {
  const [section, setSection] = useState<Section>('workspaces')
  const [creating, setCreating] = useState(false)
  const [path, setPath] = useState('')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string>()
  const [createdTitle, setCreatedTitle] = useState<string>()
  const siteState = useSyncExternalStore(sites.subscribe, sites.getSnapshot, sites.getSnapshot)

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setCreateError(undefined)
    setCreatedTitle(undefined)
    try {
      const site = await createSite({ path, ...(title.trim() === '' ? {} : { title: title.trim() }) })
      setCreatedTitle(site.title)
      setPath('')
      setTitle('')
      setCreating(false)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={css.app}>
      <header className={css.header}>
        <div className={css.brand} aria-label="GSTAR Harness">
          <span className={css.mark}>G</span>
          <span><strong>GSTAR / HARNESS</strong><small>时空数据资产中枢</small></span>
        </div>
        <nav className={css.nav} aria-label="主导航">
          {NAVIGATION.map(item => (
            <button
              key={item.id}
              type="button"
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => { setSection(item.id) }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span className={css.environment}>GSTAR PROFILE</span>
      </header>

      <main className={css.main}>
        {section === 'workspaces' ? (
          <>
            <div className={css.hero}>
              <p>REGION WORKSPACE</p>
              <h1>选择一个局点，构建可信时空数据资产</h1>
              <span>已登记的 DSH Workspace 对应局点；普通 Web 工作区不会显示在这里。</span>
            </div>
            <section className={css.metrics} aria-label="局点概览">
              <article><strong>{siteState.items.length}</strong><span>已接入局点</span></article>
              <article><strong>—</strong><span>区域资产</span></article>
              <article><strong>—</strong><span>数据源插件</span></article>
              <article><strong>—</strong><span>运行中任务</span></article>
            </section>
            <section aria-labelledby="workspace-title">
              <div className={css.sectionTitle}>
                <div><p>STATION WORKSPACES</p><h2 id="workspace-title">局点工作区</h2></div>
                <button
                  type="button"
                  aria-expanded={creating}
                  disabled={submitting}
                  onClick={() => { setCreating(value => !value) }}
                >
                  {creating ? '收起' : '创建局点'}
                </button>
              </div>
              {creating ? (
                <form className={css.createForm} onSubmit={(event) => { void submitCreate(event) }}>
                  <label>
                    <span>Host 已有目录</span>
                    <input
                      required
                      value={path}
                      placeholder="/data/stations/guangzhou"
                      onChange={(event) => { setPath(event.target.value) }}
                    />
                  </label>
                  <label>
                    <span>局点名称（可选）</span>
                    <input
                      value={title}
                      placeholder="广州局点"
                      onChange={(event) => { setTitle(event.target.value) }}
                    />
                  </label>
                  <button type="submit" disabled={submitting}>{submitting ? '创建中…' : '连接 Workspace'}</button>
                  <button type="button" disabled={submitting} onClick={() => { setCreating(false) }}>取消</button>
                  {createError === undefined ? null : <p role="alert">{createError}</p>}
                </form>
              ) : null}
              {createdTitle === undefined ? null : <p className={css.createStatus} role="status">已连接局点：{createdTitle}</p>}
              {siteState.phase === 'loading' ? (
                <p className={css.empty}>正在同步局点工作区…</p>
              ) : siteState.phase === 'error' ? (
                <p className={css.empty} role="alert">局点同步失败：{siteState.error}</p>
              ) : siteState.items.length === 0 ? (
                <p className={css.empty}>尚未创建局点。请连接 Host 上已有目录以创建第一个局点 Workspace。</p>
              ) : (
                <div className={css.grid}>
                  {siteState.items.map(site => (
                    <article className={css.card} key={site.workspaceId}>
                      <div className={css.cardTop}><span>局点工作区</span><em>已连接</em></div>
                      <h3>{site.title}</h3>
                      <p title={site.path}>{site.path}</p>
                      <dl>
                        <div><dt>区域资产</dt><dd>待配置</dd></div>
                        <div><dt>会话</dt><dd>{site.sessionCount}</dd></div>
                        <div><dt>更新时间</dt><dd>{new Date(site.updatedAt).toLocaleString('zh-CN')}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className={css.placeholder}>
            <p>{NAVIGATION.find(item => item.id === section)?.label}</p>
            <h1>运行时服务正在接入</h1>
            <span>此入口已经由 GSTAR Shell 接管，下一阶段将连接对应的 Host 领域插件。</span>
          </section>
        )}
      </main>
    </div>
  )
}
