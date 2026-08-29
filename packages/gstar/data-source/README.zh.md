# `@deepseek-ai/dsh-gstar-data-source`

[English](README.md) | 中文

Provider 中立的 GSTAR 数据源 Service Definition，注册为 `ctx.gstarDataSources`。每个数据源包在自身 Cordis 生命周期内注册一个稳定描述符和可选同步操作。活动 Provider 只投影已加载贡献，因此增删或重载数据源行无需修改空间服务或浏览器 Shell，就能改变实时目录。

`list({ workspaceId })` 合并实时插件注册表与该局点的有效选择。`setEnabled({ workspaceId, sourceId, enabled })` 保存显式局点覆盖。`synchronize({ workspaceId, sourceId })` 只执行已加载、已启用的直接数据源；参考源没有采集操作，被当作直接源调用时会失败关闭。Service Definition 持有 Remote adapter，Provider 持有持久化选择和局点成员关系校验。

`GstarDataSourceDescriptor` 将访问方式与能力分开。直接数据源可发布 AOI 或实体；参考源记录权威核验输入。局点尚未保存覆盖时使用 `defaultEnabled`，浏览器快照中的 `synchronizable` 来自已加载插件的可执行贡献，而不是配置文本。

## 模型体验

无，因为数据源管理服务不注册工具、提示词段、Session 事件或其他模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 启用状态按局点隔离，但不按操作者隔离；部署方必须把 Host gateway 保持在自身授权边界内。
- 单个来源提交后同步即报告完成；跨来源事务和带版本流水线运行属于独立能力。
- 已卸载来源的覆盖记录会保留，但在该来源插件重新加载前不会出现在 `list()` 中。
