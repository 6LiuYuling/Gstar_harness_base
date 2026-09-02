# @deepseek-ai/dsh-gstar-app

[English](README.md) | 中文

在 `dsh-web-app` 之后组合的 Profile 覆盖层。它保留 Web Host 与 Client 基础设施，只禁用标准根布局、Sidebar、通用 Workspace UI 和设置页面。`dsh-client-ui-gstar` 占有根节点并声明三栏局点 Shell；标准 DSH 对话与工具展示行保持启用，挂载到 GSTAR 右侧 slot。

覆盖层挂载 Workspace 支撑的局点 Provider、`storage-domain` 空间与来源选择 Provider、按有界 Overpass 响应配置的固定来源 Host HTTP Provider、Cesium 资产 Host 路由以及 GSTAR 专用 Client Remote 组合。`ctx.gstarSites` 只发布具有持久化 GSTAR 成员关系的 Workspace；`ctx.gstarSpatial` 根据局点名称自动解析并保存位置，并持有 AOI 几何、实体与溯源；`ctx.gstarDataSources` 把已加载来源插件与逐局点开关组合起来。普通 `dsh web` Workspace 保持在这些 GSTAR 投影之外。

OpenStreetMap 是默认启用的直接 AOI 来源。AkShare 是默认关闭的直接上市公司增强来源，要求配置的 Python 环境已安装 `akshare`。六个官方平台分别作为面向政务、企业、金融、教育和医疗核验的参考插件行。更高层 Profile 可以移除或替换任一行，而无需修改来源管理器。

在 `ui-workspace` 被禁用时，GSTAR 根插件声明标准 Workspace directory-flow 洞。因此共享的 `directory-picker-auto` 行可以原样挂载原生或浏览式交互；选中的目录经 `gstarSites.create` 完成归类，不引入 GSTAR 专用文件系统界面。

## 从源码运行

在仓库根目录依次运行 `pnpm install`、`pnpm run build` 和 `pnpm dsh gstar`。应用默认监听 `http://127.0.0.1:3080`。`pnpm dsh gstar --dump-config` 可在不启动 Host 的情况下打印 `base` → `web-app` → `gstar-app` 的完整组合树。

## 模型体验

无，因为本包改变浏览器组合，但不注册模型可见的提示词、工具或事件。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 底图影像使用轻度暗色化、保留局点尺度细节的 Esri World Imagery 卫星瓦片，自动定位使用公共 Nominatim 并以 Photon 降级，AOI 采集使用公共 Overpass，三者都需要网络访问。
- 官方参考插件不会抓取对应平台；带认证的来源专用连接器、数据处理、带版本流水线执行与变更型 Agent 工具仍属于独立 GSTAR 能力。随附的 `gstar_station_data` 工具只读。
