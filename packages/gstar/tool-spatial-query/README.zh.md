# `@deepseek-ai/dsh-gstar-tool-spatial-query`

[English](README.md) | 中文

面向局点 GSTAR 对话的只读 DSH Tool Consumer。`gstar_station_data` 从不可变的调用 Session `cwd` 解析权限，要求它精确匹配 `ctx.gstarSites` 局点路径，再读取 `ctx.gstarSpatial`。不提供 `aoi_id` 时返回局点元数据、位置、AOI 摘要、实体数量和溯源；提供 AOI id 时返回受限数量的实体字段及该 AOI 完整溯源。

该工具只由 `gstar` Profile 加载。它不信任浏览器选择或模型提供的 Workspace id，因此普通 `dsh web` Workspace 无法通过此路径查询 GSTAR 数据。

## 模型体验

### 工具 Schema

#### 模型看到什么

模型看到生成的 [`gstar_station_data` schema](../../../docs/tool-catalog.md#deepseek-aidsh-gstar-tool-spatial-query)。它提供可选 AOI id 与受限实体数量；局点身份不会成为模型可控参数。

#### Token 影响

GSTAR 工具可见时，每次请求发送一个固定只读 schema。

#### KV Cache 影响

工具可见性和定义不变时前缀稳定。

### 工具结果

#### 模型看到什么

成功调用返回当前局点 Host 快照的格式化 JSON。概览结果不包含实体数组；AOI 读取最多包含 200 个实体，并报告完整数量和是否截断。

#### Token 影响

结果随数据变化，并保留在已记录工具历史中直至压缩；`entity_limit` 限制最大实体数组。

#### KV Cache 影响

追加式结果文本位于可复用请求前缀之后，不会使更早缓存条目失效。

## 已知限制与暂缓事项

- Session 权限使用规范化 `cwd` 与局点路径的精确相等关系；没有 cwd 的 Session 无法查询 GSTAR 数据。
- 工具只读取最新空间投影，不提供历史数据版本选择器。
- AOI 详情结果会包含 AOI 几何，即使实体数量受限，结果仍可能较大。
