# Agent Note: GSTAR Profile 与局点工作区 Shell

Status: implemented

[English](2026-08-21-gstar-profile-shell.md) | 中文

## Problem

GSTAR 需要作为独立产品界面启动，同时保留 DSH Web Host、传输、存储、Workspace 运行时、主题、语言和客户端插件加载器。若把每个生成区域都作为 Workspace，就会丢失“一个局点管理多个区域”这一既有产品层次。

## Decision

`dsh gstar` 解析随仓库交付的 `gstar` Profile；该 Profile 依次组合 `dsh-base`、`dsh-web-app` 和 `dsh-gstar-app`。最后一层禁用标准根 slot 占用者、Sidebar、通用 Workspace 界面和设置页面，再把 `dsh-client-ui-gstar` 作为独立 Client 行挂载。标准对话与工具展示条目保持启用，并挂载进 GSTAR 根插件声明的 slot。Web 基础设施条目继续共享。

GSTAR Shell 仅在一个持久化 DSH Workspace 被明确归类为局点后，才把它视为局点工作区。无 React 的 GSTAR Client 运行时读取 `gstarSites.list`，并向根组件提供不可变局点 store；它不通过根 slot 的通用 `useWorkspaces` hook 推导局点成员关系。区域数量、插件数量和流水线事实只有在其 Host 领域存在后才会出现；Shell 在此之前显示不可用值，不在界面中嵌入演示数据。

区域资产属于与 Provider 无关的 `ctx.gstarSpatial` 领域，并以 `workspaceId` 关联局点，使一个局点 Workspace 能够拥有多个 AOI。其快照组合持久化局点标记与行政区/地点边界、按政、企、金融、教育、医疗、商场、居民区分类的 WGS84 Polygon/MultiPolygon AOI、规范化实体字段与采集溯源。除列表、定位和 patch 外，该 Service 还提供直接 AOI 刷新与公开数据源目录。随附的 `storage-domain` Provider 通过 `ctx.gstarSites` 过滤每次空间读写，因此普通 Workspace 无法从空间路径泄漏进 GSTAR。

持久化 `gstar_spatial` 单元保持格式版本 0：其 schema 接受旧版分类字符串，公开快照则只暴露七类分类体系中的精确成员。不受支持的旧 AOI 仍保留在存储中，并且在显式 AOI 发布替换它们之前不会进入上边栏投影，从而既不做破坏性清理，也不猜测性重分类。

GSTAR 根插件是三栏 Client 插件：左侧是已分类局点列表，中间是 Cesium 地图，右侧是标准 DSH 对话。它按标准约定声明 `conversation`、`details` 和 `shell.overlay`，并通过自身根查看状态 store 提供 `ctx.layout` action face。这样无需挂载标准 `ui-layout` 根插件，即可保留 DSH Conversation、工具详情、Session 日志与 Agent 行为。选择局点会调用标准 Workspace Client 服务，为该 Workspace 启动 Session，并显示包含七类 AOI 筛选、全选、公开来源查看、OSM 刷新和 3D/2D 投影切换的地图上边栏。两种投影都在卫星图层上渲染经过相同筛选的 Host AOI，每次切换投影都会重新适配所选几何范围。AOI 填充按分类着色并使用较小的固定椭球高度，选中 AOI 使用更强的填充与描边，使 Polygon 在两种投影中都保持显示在局点边界和卫星表面之上。

Cesium 运行时文件不由第二套前端托管。`dsh-gstar-cesium-assets` 贡献一条 DSH Web Host 前缀路由，提供已安装的 Workers、ThirdParty、Assets 和 Widgets 目录；`ui-gstar` 打包匹配的 API，并把模块基址指向该路由。Cesium 只在轻度暗色化、保留局点尺度道路、建筑与地表细节的卫星图层上投影 Host 快照。未提交坐标的局点明确保持未定位。创建时必须输入局点名称并使用标准目录流程；`gstarSpatial.locate` 通过 Host `ctx.web` Provider 固定访问 Nominatim 与 Photon 解析名称、持久化坐标及可用的 Nominatim Polygon/MultiPolygon 边界，并让 Cesium 适配所选局点边界，不再要求浏览器端点击地图。每个边界环都以高对比度折线框出；只有点位的结果继续使用固定距离相机后备。运行时支持动态代理配置时，CLI 会在 Profile 启动前将继承的 HTTP(S) 代理变量应用到 Node 全局 dispatcher。

`gstarSpatial.refreshAois` 根据该持久化边界或配置的点位半径构造有界 Overpass 查询。Provider 接收闭合 way 与 multipolygon relation，把 OSM 标签映射到产品分类，并持久化每个对象的链接、获取时间、ODbL 许可和 SHA-256 校验和。打开已有定位但尚无 AOI 发布的局点时会自动刷新一次，上边栏也提供显式更新。`gstarSpatial.listSources` 把 Overpass 标记为直接接入，并分别把国家公共数据资源登记平台、国家政务服务平台、国家企业信用信息公示系统、国家金融监督管理总局许可证查询、教育部高校名单和国家卫生健康委员会数据查询编入权威参考目录。参考状态不会把这些访问方式不同的平台表示为已经采集。

右侧对话通过 `gstar_station_data` 读取同一 Host 空间快照；这是只由 GSTAR Bundle 加载的只读 DSH Tool Consumer。它从不可变的调用 Session cwd 推导局点权限，不接受模型提供的 Workspace id，先返回摘要再返回实体数组，并限制 AOI 详情的实体结果。普通 Workspace 或没有局点 cwd 的 Session 会被拒绝。

局点身份通过与 Provider 无关的 `ctx.gstarSites` Service Definition 正式建立。随 `gstar` 交付的 `dsh-gstar-site-workspace` Provider 持有一个以 `WorkspaceId` 为键的 storage-domain sidecar；存在记录表示该通用 Workspace 已被归类为 GSTAR 局点。Provider 使用这些记录过滤 `ctx.workspaceRegistry`，把创建操作委托给该注册表，在 Workspace 创建完成后提交成员关系，并通过具体的 Typert Remote 适配器发布列表、创建与删除。删除会先准备已注册的局点所属 Host 清理，再只移除成员关系；若成员关系提交失败，则补偿已准备的清理。空间 Provider 通过该生命周期删除局点空间记录，并拦截并发 patch。Workspace 始终是身份和元数据的权威来源；删除明确保留通用 Workspace、目录与 Session 日志，供 `dsh web` 使用。

`dsh-gstar-client-remotes` 只为 `gstar` Profile 选择生成的局点与空间 contribution，并将它们挂载到 DSH 标准 Client Remote carrier。`ui-gstar` 持有无 React 的局点与空间运行时，向纯根组件注入快照 store 与 action，并在创建或空间变更成功后刷新。通用 `dsh web` 组合及其 Workspace 投影保持不变。

在标准 `ui-workspace` 行被禁用时，GSTAR 根插件声明两个标准 Workspace directory-flow 洞。`directory-picker-auto` 提供与 Web 相同的原生或浏览式占位者；其选中路径与必填局点名称交给 `gstarSites.create`，随后由 Host 侧 `gstarSpatial.locate` 自动定位。目录选择器 Client 清单依赖运行时服务，而不是某个特定洞 owner；`slots.inject()` 将其生命周期绑定到声明这对洞的根插件。

## Alternatives considered

**在 DSH 旁独立托管 GSTAR Web 应用。** 不予采用，因为它会重复实现 Web Host、持久化、Workspace 投影、权限和插件加载生命周期，而浏览器本地状态不能成为 GSTAR 的权威运行时。

**复制完整的 `dsh-web-app` Bundle 及其客户端 Shell。** 不予采用，因为 GSTAR 需要原样共享 Host 与浏览器基础设施。最后一层覆盖只替换展示条目，使上游 Web 基础设施仍可组合、可覆盖。

**把每个 AOI 表示为一个 DSH Workspace。** 不予采用，因为一个局点需要拥有多个区域、数据源配置、处理器和流水线运行。两个层级共用 Workspace 会抹去这一归属关系，并把一个局点拆散到多个独立会话容器中。

## Testing

CLI 测试固定 `gstar` 别名和应用参数边界，App Boot 测试固定随附 Bundle 顺序及组合后的 Client 服务拓扑。GSTAR 客户端 apply 测试挂载真实 `SlotRegistry`，验证根 slot 的唯一占用、加载 Host 局点投影并证明销毁回收。组件测试证明，即使标准根运行时提供了普通 Workspace，它也不会出现在局点列表中。完整组合配置可通过 `dsh gstar --dump-config` 检查。

局点 Service Definition 测试固定服务发布、销毁与 Remote 委托。Workspace Provider 测试通过真实 Loader/Include 组合运行，并验证成员过滤、注册表顺序投影、创建委托、持久化归类、幂等重连及领域销毁。

GSTAR Client 组合测试固定两个生成 contribution 的挂载与逆序销毁。UI apply 与运行时测试固定精确 Remote 依赖、成功/错误信封处理、创建、删除或空间变更后刷新、过期响应抑制、directory-flow 声明、标准 conversation/details slot 和占位者实时可用性。Loader 组合测试覆盖持久化成员关系删除、通用 Workspace 身份保留、边界持久化、空间清理补偿与删除准入关闭。组件测试驱动带名称与 Host 目录的局点创建、Host 自动定位、删除确认、局点选择、七类筛选、来源模式展示、OSM 自动刷新、3D/2D 切换、AOI 选择、实体字段展示与溯源展示。Cesium 投影测试还固定 AOI 显示高度、普通与选中状态的填充透明度及描边显著度。

空间 Service Definition 测试固定 Remote 委托。其 storage Provider 测试通过真实 Loader/Include 组合运行，证明局点过滤、未提供字段保留、不做重分类的版本 0 分类兼容、带局点后缀规范化的 Nominatim 至 Photon 传输降级、有界 Overpass 请求构造、OSM 分类与溯源发布、来源目录角色、位置与 AOI 提交、普通 Workspace 拒绝、串行销毁和领域关闭。CLI 测试固定继承代理启动及其较旧 Node 诊断。Cesium 资产测试固定路径穿越防护、MIME、不可变缓存、路由组合与方法拒绝。

包级 Model Experience 审计把 GSTAR Bundle、UI、局点/空间 Service Definition 及其 Provider、Cesium Host 路由和 Client Remote 组合归类为模型中性 contribution。

## Consequences

`gstar` 组合无需复制 Web 基础设施或修改通用 Workspace 约定，即可启动为基于真实 Workspace 的三栏局点界面。现有格式版本 0 的空间存储无需删除即可打开；旧分类不属于当前七类筛选项的 AOI 保持持久化，但不会显示。普通 Web Workspace 不进入 GSTAR，除非用户明确选择其路径并将其归类为局点。局点标记、边界、OSM AOI、实体和溯源都是持久化 Host 数据；位置、边界或 AOI 发布缺失时会明确保持缺失。用户可以筛选七类 AOI、查看直接源与参考源、刷新 OSM，并从 GSTAR 删除测试局点而不删除目录或 DSH 历史。选择带边界的局点会用框线标出，并让 Cesium 在 3D 或 2D 投影中适配其几何范围。即使分类 Polygon 的源几何位于椭球表面，它们仍能在卫星图层上保持可区分。右侧是真实 DSH Conversation 树，而不是仿制对话组件，其只读局点查询由调用 Session 限定。官方来源专用连接器、数据处理、带版本流水线执行与变更型 Agent 工具仍作为后续独立能力实现。
