# `@deepseek-ai/dsh-gstar-data-source-osm`

[English](README.md) | 中文

可动态加载的 GSTAR OpenStreetMap 数据源插件。它把 `osm-overpass` 注册为默认启用、具有 AOI 和实体能力的直接来源。同步委托给 Host 空间 Provider 的有界 Overpass 采集，并报告已提交 AOI 数量。

空间 Provider 继续持有查询范围、局点边界相交、分片、限流重试、OSM 解码和 AOI 全量原子替换。本包只持有来源身份、目录元数据、动态生命周期和受策略控制的执行入口。移除其 Cordis 行会从实时来源注册表移除 OSM，并阻止浏览器经 `gstarDataSources` 同步。

## 模型体验

无，因为 OSM 来源插件不注册模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 随附来源使用 `dsh-gstar-spatial-storage` 配置的公共 Overpass endpoint；部署方应提供符合自身用量策略的 endpoint。
- Nominatim 与 Photon 地理编码仍属于空间 Provider，不通过该来源插件选择。
- OSM 同步会替换当前 OSM AOI 发布；多来源实体协调仍由来源专用逻辑持有。
