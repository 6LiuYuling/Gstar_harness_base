# @deepseek-ai/dsh-gstar-app

[English](README.md) | 中文

在 `dsh-web-app` 之后组合的 Profile 覆盖层。它保留 Web Host 与 Client 基础设施，同时用 `dsh-client-ui-gstar` 替换标准聊天根界面。标准聊天展示行会被禁用，因为其 slot 属于已经被替换的 Shell。

## 从源码运行

在仓库根目录依次运行 `pnpm install`、`pnpm run build` 和 `pnpm dsh gstar`。应用默认监听 `http://127.0.0.1:3080`。`pnpm dsh gstar --dump-config` 可在不启动 Host 的情况下打印 `base` → `web-app` → `gstar-app` 的完整组合树。

## 模型体验

没有直接影响。本包改变浏览器界面，但不注册模型可见的提示词、工具或事件。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 第一阶段只提供 GSTAR 工作区 Shell 并读取现有 Workspace 投影；区域资产和流水线数据将在后续专用 Host 领域包中接入。
- 第一阶段不挂载 Agent 对话；后续通过 GSTAR 自有 slot 恢复，而不是依赖标准布局的私有 slot 树。
