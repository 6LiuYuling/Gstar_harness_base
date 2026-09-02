# `@deepseek-ai/dsh-gstar-data-source-storage`

[English](README.md) | 中文

[`ctx.gstarDataSources`](../data-source/README.zh.md) 的 `storage-domain` Provider。它持有实时数据源 Provider 注册表，并为每个已分类局点保存一条持久化覆盖记录。插件 effect 会增加和移除精确注册贡献；重复来源 id，以及直接／参考操作形态不合法，都会在注册时失败。

Provider 在读取和同步前校验 GSTAR 局点成员关系。选择写入与局点删除串行化。局点删除 preparation 会在成员关系提交前移除来源覆盖，并可在 rollback 时恢复完整记录。Provider dispose 会关闭新操作接纳，排空已接纳写入，然后关闭 `gstar_data_sources` domain。

同步会在执行前解析 Provider 和有效启用状态。已停用、未加载和只读参考来源都会在调用采集前拒绝。来源插件持有自身发布事务；本 Provider 只在操作成功后返回摘要并记录完成时间。

## 模型体验

无，因为存储 Provider 只持久化产品配置，不注册模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- Domain 版本 `0` 只保存布尔覆盖；调度、凭据和来源专用选项仍属于各插件配置。
- 实时注册表由单进程持有；分布式来源编排需要独立协调设计。
- 同步操作不会全局串行化，因此每个来源插件必须自行保护外部限流和提交边界。
