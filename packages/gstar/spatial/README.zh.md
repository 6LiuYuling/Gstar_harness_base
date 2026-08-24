# `@deepseek-ai/dsh-gstar-spatial`

[English](README.md) | 中文

基于 `ctx.gstarSpatial` 的 GSTAR 空间 Service Definition，与具体 Provider 无关。它以局点持久化 `WorkspaceId` 为键，在 Host 能力后统一保存局点位置、已发布 AOI 几何、规范化实体字段与采集溯源。浏览器通过生成的 Typert Remote 获得类型化快照；Cesium 只是投影 Consumer，不成为业务数据权威。

`list()` 为每个已分类局点返回一个空间快照。`patch({ workspaceId, location?, aois? })` 保留未提供字段，因此局点定位与流水线 AOI 发布可以独立提交。AOI 支持 WGS84 Polygon 或 MultiPolygon 几何，并在同一发布快照中携带实体字段和溯源记录。

## 模型体验

无，因为空间服务不注册工具、提示词段落、Session 事件或其他模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- AOI 发布目前替换局点完整 AOI 集合；数据版本谱系与局部 AOI 变更属于后续流水线领域。
- 约定尚未携带已认证操作者或局点级授权策略。
- 溯源记录是类型化快照，但尚未签名或独立证明。
