# `@deepseek-ai/dsh-gstar-site-workspace`

[English](README.md) | 中文

由 DSH Workspace 支撑的 `ctx.gstarSites` Provider。storage-domain sidecar 记录哪些通用 Workspace ID 已被明确连接为 GSTAR 局点。`list()` 使用该持久化成员关系过滤 Workspace 注册表并保留其顺序，因此普通 `dsh web` Workspace 不会出现在 `dsh gstar` 中。局点创建先委托给 `ctx.workspaceRegistry.create`，随后提交成员关系，因此规范化路径相同的重复请求会复用同一个 Workspace 身份。

成员关系 sidecar 不复制 Workspace 元数据。DSH Workspace 始终是局点身份和元数据的权威来源；局点所属的 GSTAR 领域通过 `workspaceId` 引用它。明确连接一个已有的普通 Workspace，会把同一身份归类为 GSTAR 局点，而不修改通用 Workspace 记录。

`delete()` 会先准备全部已注册的局点所属数据清理，再只删除成员关系记录；若成员关系写入失败，则补偿已准备的清理。底层 Workspace 仍保留注册，目录与 Session 日志也不变，因此它会从 `dsh gstar` 消失，但仍可在 `dsh web` 中作为普通 Workspace 使用。

## 模型体验

无，因为该 Provider 不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 创建操作继承 Workspace 的约束：目标目录必须已经存在于 Host。
- 在持久化局点成员关系引入前创建的 Workspace 保持未分类，直至通过 GSTAR 明确连接。
- Workspace 标题和元数据时间只表示局点元数据；GSTAR 数据版本时间由流水线领域持有。
