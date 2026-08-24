# @deepseek-ai/dsh-gstar-app

[English](README.md) | 中文

在 `dsh-web-app` 之后组合的 Profile 覆盖层。它保留 Web Host 与 Client 基础设施，禁用标准聊天布局，并把 `dsh-client-ui-gstar` 作为独立根插件挂载。标准聊天展示行会被禁用，因为其 slot 属于已经被替换的 Shell；不含界面的 `ui-settings` 领域服务仍保持启用，以便向 locale 和 theme 提供 `settingsScope`。

覆盖层同时挂载 `dsh-gstar-site-workspace` 和 `dsh-gstar-client-remotes`。Host Provider 通过 `ctx.gstarSites` 把每个持久化 Workspace 发布为一个 GSTAR 局点；GSTAR 专用 Client Remote 组合把该生成 namespace 挂载到标准 DSH Remote carrier。浏览器不持有重复的局点数据库。

## 从源码运行

在仓库根目录依次运行 `pnpm install`、`pnpm run build` 和 `pnpm dsh gstar`。应用默认监听 `http://127.0.0.1:3080`。`pnpm dsh gstar --dump-config` 可在不启动 Host 的情况下打印 `base` → `web-app` → `gstar-app` 的完整组合树。

## 模型体验

无，因为本包改变浏览器组合，但不注册模型可见的提示词、工具或事件。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 局点身份和创建现在依次经过 Workspace 支撑的 Host Service、生成的 Typert Remote、GSTAR 专用 Client 组合和注入根组件的 action。
- 区域资产和流水线数据将在后续专用 Host 领域包中接入。
- 第一阶段不挂载 Agent 对话；后续通过 GSTAR 自有 slot 恢复，而不是依赖标准布局的私有 slot 树。
