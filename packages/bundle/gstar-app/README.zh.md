# @deepseek-ai/dsh-gstar-app

[English](README.md) | 中文

在 `dsh-web-app` 之后组合的 Profile 覆盖层。它保留 Web Host 与 Client 基础设施，只禁用标准根布局、Sidebar、通用 Workspace UI 和设置页面。`dsh-client-ui-gstar` 占有根节点并声明三栏局点 Shell；标准 DSH 对话与工具展示行保持启用，挂载到 GSTAR 右侧 slot。

覆盖层挂载 Workspace 支撑的局点 Provider、`storage-domain` 空间 Provider、固定来源的 Host HTTP Provider、Cesium 资产 Host 路由以及 GSTAR 专用 Client Remote 组合。`ctx.gstarSites` 只发布具有持久化 GSTAR 成员关系的 Workspace；`ctx.gstarSpatial` 根据局点名称自动解析并保存位置，同时持有 AOI、实体与溯源。普通 `dsh web` Workspace 保持在两种 GSTAR 投影之外。

在 `ui-workspace` 被禁用时，GSTAR 根插件声明标准 Workspace directory-flow 洞。因此共享的 `directory-picker-auto` 行可以原样挂载原生或浏览式交互；选中的目录经 `gstarSites.create` 完成归类，不引入 GSTAR 专用文件系统界面。

## 从源码运行

在仓库根目录依次运行 `pnpm install`、`pnpm run build` 和 `pnpm dsh gstar`。应用默认监听 `http://127.0.0.1:3080`。`pnpm dsh gstar --dump-config` 可在不启动 Host 的情况下打印 `base` → `web-app` → `gstar-app` 的完整组合树。

## 模型体验

无，因为本包改变浏览器组合，但不注册模型可见的提示词、工具或事件。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 在真实采集/处理流水线通过空间 Service 发布前，AOI 记录保持为空。
- 底图影像目前使用暗色化 Esri World Imagery 卫星瓦片，自动定位使用公共 Nominatim 并以 Photon 降级，两者都需要网络访问。
- 数据源配置、数据处理、流水线执行与变更型 Agent 工具仍属于后续 GSTAR 能力；随附的 `gstar_station_data` 工具只读。
