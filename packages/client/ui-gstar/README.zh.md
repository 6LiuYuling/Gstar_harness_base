# @deepseek-ai/dsh-client-ui-gstar

[English](README.md) | 中文

GSTAR 浏览器根 Shell。它占用内置 `root` slot，并把持久化 DSH Workspace 投影为局点工作区。尚不可用的区域、数据源、门禁和流水线指标保持待接入状态，不在 React 中伪造产品数据。

注册它的 Client 插件向纯根组件注入 `createSite` action。该 action 调用 `ctx.remote.gstarSites.create`；成功创建后由 Host Workspace 注册表持久化，标准 Workspace 投影提供实时局点列表。React 从不持有权威局点状态。

## 模型体验

无，因为本包是浏览器展示插件，不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 区域资产以及插件、流水线投影尚未连接；对应导航入口只标识下一步 Host 服务，不展示模拟记录。
- 创建表单接收 Host 上已有目录；后续 UI 切片会用 DSH directory-picker contribution 替换手工路径输入。
