# `@deepseek-ai/dsh-gstar-spatial`

[English](README.md) | 中文

基于 `ctx.gstarSpatial` 的 GSTAR 空间 Service Definition，与具体 Provider 无关。它以局点持久化 `WorkspaceId` 为键，在 Host 能力后统一保存局点位置、行政区/地点边界、已发布 AOI 几何、规范化实体字段与采集溯源。浏览器通过生成的 Typert Remote 获得类型化快照；Cesium 只是投影 Consumer，不成为业务数据权威。

`list()` 为每个已分类局点返回一个空间快照。`locate({ workspaceId, query })` 由当前 Host Provider 根据用户输入的局点名称解析位置，并持久化标记及可用的 Polygon/MultiPolygon 边界。`refreshAois({ workspaceId })` 是供动态加载 OSM 来源插件调用的 Host 专用采集操作；浏览器经 `gstarDataSources` 执行，以强制检查局点启用状态。`patch({ workspaceId, location?, boundary?, aois? })` 保留未提供字段；`boundary: null` 会明确清除过期边界。AOI 使用政、企、金融、教育、医疗、商场、居民区七类产品分类，支持 WGS84 Polygon 或 MultiPolygon 几何，并在同一发布快照中携带实体字段和溯源记录。

## 模型体验

无，因为空间服务不注册工具、提示词段落、Session 事件或其他模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- AOI 刷新与发布会替换局点完整 AOI 集合；数据版本谱系与局部 AOI 变更属于后续流水线领域。
- 来源发现、局点选择与同步策略属于 `dsh-gstar-data-source`，不属于本几何领域。
- 约定尚未携带已认证操作者或局点级授权策略。
- 溯源记录是类型化快照，但尚未签名或独立证明。
