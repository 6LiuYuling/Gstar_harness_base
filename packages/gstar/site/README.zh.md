# `@deepseek-ai/dsh-gstar-site`

[English](README.md) | 中文

基于 `ctx.gstarSites` 的 GSTAR 局点 Service Definition，与具体 Provider 无关。局点直接使用持久化 `WorkspaceId` 作为身份，使后续 GSTAR 区域、数据源配置、处理器和流水线运行都能共享同一个稳定所有者，而无需修改通用 Workspace 记录。

`list()` 按当前 Workspace Provider 的持久顺序返回不可变局点快照。`create({ path, title? })` 通过该 Provider 解析或创建局点；目录校验和路径规范化规则由 Provider 持有。Remote 适配器以 `gstarSites.list` 和 `gstarSites.create` 发布相同操作，供 Host 支撑的客户端组合使用。

`GstarSiteSnapshot.updatedAt` 表示 Workspace 元数据变更时间，不是 GSTAR 数据更新时间。成功发布数据版本后，流水线领域负责持有 `lastSuccessfulUpdateAt`。

## 模型体验

无，因为局点服务不注册工具、提示词段落、Session 事件或其他模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 随附的 Workspace Provider 要求 Host 上已有目录；GSTAR Shell 通过 DSH 标准目录选择器组合访问它。
- Host Remote 约定已经存在，但 GSTAR Client Remote 组合与 UI Consumer 属于独立包。
- 服务没有携带已认证操作者或局点级授权策略；部署必须把 Host 网关放在可信边界内。
