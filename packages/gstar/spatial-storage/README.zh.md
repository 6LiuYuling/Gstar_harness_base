# `@deepseek-ai/dsh-gstar-spatial-storage`

[English](README.md) | 中文

基于 `storage-domain` 的 `ctx.gstarSpatial` Provider。它打开 `gstar_spatial` 域，以局点 `WorkspaceId` 保存一条记录，并通过 `ctx.gstarSites` 过滤所有读取和写入。因此，普通 `dsh web` Workspace 在未被持久化分类为局点前，不能获得或暴露 GSTAR 空间记录。

写入由 Provider 自有操作链串行化，并在域关闭前全部完成。未提供的位置、边界或 AOI 字段保留持久化值；`boundary: null` 清除当前局点边界，空 AOI 数组清除当前 AOI 投影。该 Provider 参与 `gstarSites.delete`：在删除成员关系前移除局点空间记录、拦截并发 patch，并在成员关系删除提交前提供持久化回滚。

`locate()` 通过注入的 DSH `ctx.web` 能力依次尝试 Nominatim 与 Photon，优先去掉中文「局点/站点」后缀并在未命中时回退到完整名称，校验返回的 WGS84 坐标，并通过同一空间写入路径持久化。Nominatim 会请求简化 GeoJSON 几何；合法 Polygon/MultiPolygon 成为局点边界，并以 Nominatim bounding box 作为矩形后备。Photon 继续作为只返回标记的可用性后备。传输、HTTP 与异常载荷失败会继续尝试下一个 Host 提供方，并保留原因链用于 Remote 诊断。浏览器不会直接发起地理编码请求。

`refreshAois()` 根据已持久化局点边界构建有界 Overpass 查询；没有边界时使用配置的点位半径。响应一旦达到单次请求要素上限即视为不完整，其范围会递归四分；完整分块按稳定 OSM id 合并后，再应用局点真实 Polygon/MultiPolygon 边界。Provider 串行发送公共 Overpass 请求，在请求之间保留配置的间隔，并对 HTTP 429 执行有上限的指数退避重试。只有完整刷新成功后才会写入，因此限流失败会保留上一版持久化 AOI。解码器接收闭合 way 与 multipolygon relation，把 OSM 标签映射到七类 GSTAR AOI，为每个 OSM 要素发布一条规范化实体，并记录 OSM 对象链接、获取时间、ODbL 许可和 SHA-256 校验和。动态加载的 OSM 来源插件持有目录身份，并经局点来源管理器调用这个 Host 专用操作。

## 配置

| 字段 | 默认值 | 含义 |
|---|---:|---|
| `overpassEndpoint` | `https://overpass-api.de/api/interpreter` | AOI 直接采集端点。 |
| `overpassTimeoutSeconds` | `120` | Overpass 服务端查询超时。 |
| `overpassMaxElements` | `2000` | 触发自适应分块的单次请求要素上限。 |
| `overpassRequestIntervalMilliseconds` | `1000` | 一次响应完成到下一次请求之间的最短等待时间。 |
| `overpassRetryDelayMilliseconds` | `30000` | HTTP 429 的首次重试等待时间；后续重试倍增。 |
| `overpassMaxRetries` | `2` | 单个受限分块请求的最大重试次数。 |
| `fallbackRadiusMeters` | `15000` | 局点没有边界时使用的点位搜索半径。 |

## 模型体验

无，因为该 Provider 不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 当前 KV 记录只保存最新空间投影，不保留数据版本历史。
- 大型实体集合仍内嵌在局点记录中；对象存储和索引化空间数据库将作为同一 Service Definition 的后续 Provider。
- 授权目前只基于持久化局点成员关系，而不是已认证用户策略。
- 公共 Nominatim、Photon 与 Overpass 的可用性和使用政策仍是外部部署依赖；生产部署可在同一 Service Definition 后替换 Provider。
- 官方参考源具有不同的访问控制与响应格式；本 Provider 将其编入校验目录，但不把它们表示为已直接采集的记录。
