# @deepseek-ai/dsh-client-ui-gstar

[English](README.md) | 中文

GSTAR 浏览器根 Shell。它占用内置 `root` slot，并渲染 Host 已分类的 `gstarSites.list` 投影，因此通用 `dsh web` Workspace 不会进入局点界面。尚不可用的区域、数据源、门禁和流水线指标保持待接入状态，不在 React 中伪造产品数据。

注册它的 Client 插件持有一个由 GSTAR Remote namespace 支撑的无 React 局点运行时。该运行时加载 `gstarSites.list`、公开不可变快照 store，并在 `gstarSites.create` 后刷新；React 不持有或过滤权威局点成员关系。

在标准 `ui-workspace` 行缺席时，根条目声明与 `dsh web` 相同的两个 directory-flow 洞。因此 `directory-picker-auto` 会原样提供原生选择器或应用内「选择工作区目录」对话框。选中的 Host 路径直接交给 `gstarSites.create`；GSTAR 不包含手工路径输入，也不复制文件系统浏览器。

## 模型体验

无，因为本包是浏览器展示插件，不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 区域资产以及插件、流水线投影尚未连接；对应导航入口只标识下一步 Host 服务，不展示模拟记录。
