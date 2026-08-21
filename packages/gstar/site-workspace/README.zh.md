# `@deepseek-ai/dsh-gstar-site-workspace`

[English](README.md) | 中文

由 DSH Workspace 支撑的 `ctx.gstarSites` Provider。它把每个持久化 Workspace 视为一个 GSTAR 局点，保留注册表顺序，并把实体 getter 复制成不可变、JSON 兼容的快照。局点创建委托给 `ctx.workspaceRegistry.create`，因此规范化路径相同的重复请求会复用同一个 Workspace 身份。

该 Provider 不创建第二张局点表，也不会把 Workspace 记录复制到浏览器存储。DSH Workspace 始终是局点身份和元数据的权威来源；局点所属的 GSTAR 领域通过 `workspaceId` 引用它。

## 模型体验

无。该 Provider 不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 创建操作继承 Workspace 的约束：目标目录必须已经存在于 Host。
- Workspace 标题和元数据时间只表示局点元数据；GSTAR 数据版本时间由流水线领域持有。
