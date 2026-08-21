# `@deepseek-ai/dsh-gstar-client-remotes`

[English](README.md) | 中文

标准 DSH Client Remote 组合的 GSTAR 专用扩展。其浏览器端把生成的 `dsh-gstar-site/remote` contribution 挂载到既有 `ctx.remote` carrier。该包只存在于 `gstar-app` Bundle 中，因此 `dsh web` 不会获得 GSTAR namespace。

Consumer 同时注入 `remote` 和所使用的精确 namespace 服务，例如 `remote.gstarSites`。Typert carrier 负责请求信封、codec、发布与销毁；本包只为产品 Profile 选择 GSTAR contribution。

## 模型体验

无，因为该组合只选择浏览器 Remote namespace，不注册提示词、工具、Session 事件或其他模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 当前只选择局点 namespace；区域、数据源配置、处理器和流水线在各自 Host Service Definition 建立后加入这里。
- 本包不转发 Host 事件；当前局点列表的新鲜度继续由 DSH 既有 Workspace 投影保证。
