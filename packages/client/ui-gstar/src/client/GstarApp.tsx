import { useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './GstarApp.module.css'

type Section = 'workspaces' | 'sources' | 'gates' | 'pipelines'

const NAVIGATION: readonly { id: Section; label: string }[] = [
  { id: 'workspaces', label: '区域资产' },
  { id: 'sources', label: '数据源插件' },
  { id: 'gates', label: '质量门禁' },
  { id: 'pipelines', label: '数据流水线' },
]

/** Props supplied by the root slot runtime. */
export type GstarAppProps = PropsRuntime<'root'>

/**
 * Render the GSTAR root projection from DSH Workspace snapshots.
 * @param props - Framework-bound root runtime hooks.
 * @returns the GSTAR application shell.
 */
export function GstarApp({ useWorkspaces }: GstarAppProps) {
  const [section, setSection] = useState<Section>('workspaces')
  const workspaces = useWorkspaces(state => state.items)
  const phase = useWorkspaces(state => state.phase)

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
              <span>DSH Workspace 对应局点；区域资产、数据源与处理流水线将在局点下统一管理。</span>
            </div>
            <section className={css.metrics} aria-label="局点概览">
              <article><strong>{workspaces.length}</strong><span>已接入局点</span></article>
              <article><strong>—</strong><span>区域资产</span></article>
              <article><strong>—</strong><span>数据源插件</span></article>
              <article><strong>—</strong><span>运行中任务</span></article>
            </section>
            <section aria-labelledby="workspace-title">
              <div className={css.sectionTitle}>
                <div><p>STATION WORKSPACES</p><h2 id="workspace-title">局点工作区</h2></div>
                <button type="button" disabled>创建局点</button>
              </div>
              {phase !== 'ready' ? (
                <p className={css.empty}>正在同步局点工作区…</p>
              ) : workspaces.length === 0 ? (
                <p className={css.empty}>尚未创建局点。局点创建能力将在局点领域服务接入后开放。</p>
              ) : (
                <div className={css.grid}>
                  {workspaces.map(workspace => (
                    <article className={css.card} key={workspace.workspaceId}>
                      <div className={css.cardTop}><span>局点工作区</span><em>已连接</em></div>
                      <h3>{workspace.title}</h3>
                      <p title={workspace.path}>{workspace.path}</p>
                      <dl>
                        <div><dt>区域资产</dt><dd>待配置</dd></div>
                        <div><dt>会话</dt><dd>{workspace.sessionIds.length}</dd></div>
                        <div><dt>更新时间</dt><dd>{new Date(workspace.updatedAt).toLocaleString('zh-CN')}</dd></div>
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
