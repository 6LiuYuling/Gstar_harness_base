# `@deepseek-ai/dsh-gstar-cesium-assets`

English | [中文](README.zh.md)

DSH Web Host plugin that serves the installed CesiumJS `Build/Cesium` tree at `/gstar/cesium`. The route supplies Workers, ThirdParty modules, Assets, and Widgets to the GSTAR Client plugin without creating a second web server or separately deployed frontend. Requests are confined to the installed asset root and receive immutable cache headers.

The browser bundle and Host route use the same pinned Cesium dependency. `ui-gstar` sets Cesium's module base URL to this DSH route before constructing the globe.

## Model Experience

None, as the static-asset Host route registers no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Cesium runtime assets add a substantial installed dependency and browser download footprint.
- The route assumes the locally installed Cesium package is trusted and immutable for the process lifetime.
- Base-map imagery policy and availability belong to the consuming UI; this package serves Cesium runtime assets only.
