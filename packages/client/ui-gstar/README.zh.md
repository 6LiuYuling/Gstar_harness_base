# @deepseek-ai/dsh-client-ui-gstar

[English](README.md) | 中文

GSTAR 浏览器根 Shell。它占用内置 `root` slot，渲染三栏局点工作区：左侧是 Host 已分类的局点列表，中间是支持 3D 与 2D 投影切换的 Cesium 地图，右侧是标准 DSH Conversation occupant。通用 `dsh web` Workspace 不会进入局点界面。

注册它的 Client 插件持有由 `gstarSites` 与 `gstarSpatial` Remote namespace 支撑的无 React 局点和空间运行时。Cesium 只投影 Host 快照：持久化局点标记与边界、AOI Polygon/MultiPolygon 几何、实体字段与数据溯源。选择局点会为该局点 Workspace 启动 DSH Session，以高对比度框线绘制边界并让相机适配该几何范围，同时显示一条地图上边栏，集中提供政、企、金融、教育、医疗、商场、居民区、全选筛选、3D/2D 投影切换、OSM 刷新和公开数据源目录。打开已有定位但尚无 AOI 发布的局点时，会自动发起一次 Host 侧 OSM 刷新。切换投影后会重新适配所选边界或 AOI。现有 `ui-conversation` 插件继续渲染到声明的 `conversation` slot。只有点位而无边界时，暂时使用固定距离的相机后备。

标准 `ui-workspace` 行保持缺席，但根条目声明与 `dsh web` 相同的 directory-flow 洞。因此 `directory-picker-auto` 会原样提供原生选择器或应用内「选择工作区目录」对话框。用户输入必填局点名称并选择 Host 路径；`gstarSites.create` 完成后，`gstarSpatial.locate` 在 Host 侧解析并持久化标记，Cesium 自动飞到已提交坐标。

每张局点卡片都提供显式删除操作和确认对话框。该操作调用 Host `gstarSites.delete` Remote，并刷新两类 Host 投影；对话框会准确说明只删除 GSTAR 分类与局点所属资产，通用 DSH Workspace、目录和 Session 日志保持不变。

## 模型体验

无，因为本包是浏览器展示插件，不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- AOI 来自 Host Overpass Provider 或其他流水线发布；浏览器不会伪造示例几何或溯源。
- 官方来源在来源专用连接器完成直接采集前，会明确标注为参考源。
- 首个地图 Provider 使用轻度暗色化的 Esri World Imagery 卫星瓦片，在局点尺度保留道路与建筑细节，并采用椭球地形；部署方仍需制定自己的影像与离线策略。
- 右侧窄栏复用了完整 DSH 对话树与只读 `gstar_station_data` 工具；数据变更和流水线控制工具仍待实现。
