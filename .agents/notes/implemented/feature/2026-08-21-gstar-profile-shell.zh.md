# Agent Note: GSTAR Profile 与局点工作区 Shell

Status: implemented

[English](2026-08-21-gstar-profile-shell.md) | 中文

## Problem

GSTAR 需要作为独立产品界面启动，同时保留 DSH Web Host、传输、存储、Workspace 运行时、主题、语言和客户端插件加载器。若把每个生成区域都作为 Workspace，就会丢失“一个局点管理多个区域”这一既有产品层次。

## Decision

`dsh gstar` 解析随仓库交付的 `gstar` Profile；该 Profile 依次组合 `dsh-base`、`dsh-web-app` 和 `dsh-gstar-app`。最后一层用 `dsh-client-ui-gstar` 替换标准根 slot 的占用者，并禁用依赖标准聊天 Shell 私有 slot 的展示条目。Web 基础设施条目继续共享。

GSTAR Shell 把一个持久化 DSH Workspace 视为一个局点工作区。它通过根 slot 的标准 `useWorkspaces` hook 读取既有的无 React Workspace 投影。区域数量、插件数量和流水线事实只有在其 Host 领域存在后才会出现；Shell 在此之前显示不可用值，不在界面中嵌入演示数据。

区域资产属于独立领域，并以 `workspaceId` 关联局点，使一个局点 Workspace 能够拥有多个 AOI。Agent 对话后续通过 GSTAR 自有 slot 恢复，因此 GSTAR 不依赖标准布局的私有 slot 树。

局点身份通过与 Provider 无关的 `ctx.gstarSites` Service Definition 正式建立。随 `gstar` 交付的 `dsh-gstar-site-workspace` Provider 从 `ctx.workspaceRegistry` 投影不可变局点快照，把创建操作委托给该注册表，并通过具体的 Typert Remote 适配器发布 `gstarSites.list` 和 `gstarSites.create`。Workspace 始终是唯一持久化权威，GSTAR 不创建平行的局点表。

## Alternatives considered

**在 DSH 旁独立托管 GSTAR Web 应用。** 不予采用，因为它会重复实现 Web Host、持久化、Workspace 投影、权限和插件加载生命周期，而浏览器本地状态不能成为 GSTAR 的权威运行时。

**复制完整的 `dsh-web-app` Bundle 及其客户端 Shell。** 不予采用，因为 GSTAR 需要原样共享 Host 与浏览器基础设施。最后一层覆盖只替换展示条目，使上游 Web 基础设施仍可组合、可覆盖。

**把每个 AOI 表示为一个 DSH Workspace。** 不予采用，因为一个局点需要拥有多个区域、数据源配置、处理器和流水线运行。两个层级共用 Workspace 会抹去这一归属关系，并把一个局点拆散到多个独立会话容器中。

## Testing

CLI 测试固定 `gstar` 别名和应用参数边界，App Boot 测试固定随附 Bundle 顺序。GSTAR 客户端 apply 测试挂载真实 `SlotRegistry`，验证根 slot 的唯一占用并证明销毁回收；组件测试验证 Workspace 快照投影和导航文案，不构造虚假的领域记录。完整组合配置可通过 `dsh gstar --dump-config` 检查。

局点 Service Definition 测试固定服务发布、销毁与 Remote 委托。Workspace Provider 测试通过真实 Loader/Include 组合运行，并验证有序投影及创建委托。

## Consequences

第一阶段 `gstar` 组合无需复制 Web 基础设施或修改通用 Workspace 约定，即可启动为基于真实 Workspace 的局点界面。产品导航可以先于各数据能力出现，同时每个尚不可用的领域都保持明确。代价是数据源、门禁和流水线入口暂时显示服务占位，且在 GSTAR Client Remote 组合消费 Host 服务之前，浏览器中的局点创建入口保持禁用。
