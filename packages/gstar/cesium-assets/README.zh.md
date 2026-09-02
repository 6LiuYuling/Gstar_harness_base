# `@deepseek-ai/dsh-gstar-cesium-assets`

[English](README.md) | 中文

DSH Web Host 插件，把已安装 CesiumJS 的 `Build/Cesium` 目录发布到 `/gstar/cesium`。该路由向 GSTAR Client 插件提供 Workers、ThirdParty 模块、Assets 与 Widgets，不会创建第二个 Web Server 或独立部署前端。请求被限制在安装资产根目录内，并返回不可变缓存头。

浏览器 Bundle 与 Host 路由使用同一个固定 Cesium 依赖。`ui-gstar` 在创建地球前把 Cesium 模块基址指向这条 DSH 路由。

## 模型体验

无，因为静态资产 Host 路由不注册模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- Cesium 运行时资产会增加安装依赖和浏览器下载体积。
- 路由假定本地安装的 Cesium 包在进程生命周期内可信且不可变。
- 底图影像策略与可用性属于消费方 UI；本包只提供 Cesium 运行时资产。
