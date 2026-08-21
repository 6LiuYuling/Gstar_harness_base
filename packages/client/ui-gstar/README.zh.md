# @deepseek-ai/dsh-client-ui-gstar

[English](README.md) | 中文

GSTAR 浏览器根 Shell。它占用内置 `root` slot，并把持久化 DSH Workspace 投影为局点工作区。第一阶段将尚不可用的区域、数据源、门禁和流水线指标显示为待接入，不在 React 中伪造产品数据。

## 模型体验

无。本包只负责展示，不贡献模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 区域资产以及插件、流水线投影尚未连接；对应导航入口只标识下一步 Host 服务，不展示模拟记录。
- 在局点领域能够原子创建和校验配套局点档案之前，Workspace 创建入口保持禁用。
