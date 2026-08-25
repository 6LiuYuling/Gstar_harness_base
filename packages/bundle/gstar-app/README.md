# @deepseek-ai/dsh-gstar-app

English | [中文](README.zh.md)

Profile overlay composed after `dsh-web-app`. It keeps the Web Host and Client infrastructure while disabling only the standard root layout, sidebar, generic Workspace UI, and settings pages. `dsh-client-ui-gstar` owns the root and declares a three-column station shell; the standard DSH conversation and tool-presentation rows remain active and mount into GSTAR's right-hand slots.

The overlay mounts the Workspace-backed station Provider, the `storage-domain` spatial Provider, a fixed-origin Host HTTP Provider, the Cesium asset Host route, and the GSTAR-only Client Remote assembly. `ctx.gstarSites` exposes only Workspaces with durable GSTAR membership; `ctx.gstarSpatial` resolves and persists station-name locations and owns their AOIs, entities, and provenance. Ordinary `dsh web` Workspaces stay outside both GSTAR projections.

The GSTAR root declares the standard Workspace directory-flow holes while `ui-workspace` is disabled. The shared `directory-picker-auto` row can therefore mount its native or browse interaction unchanged; a selected directory is classified through `gstarSites.create` instead of a GSTAR-specific filesystem UI.

## Run from source

From the repository root, run `pnpm install`, `pnpm run build`, then `pnpm dsh gstar`. The application listens on `http://127.0.0.1:3080` by default. `pnpm dsh gstar --dump-config` prints the composed `base` → `web-app` → `gstar-app` tree without starting the Host.

## Model Experience

None, as this package changes the browser composition but registers no model-visible prompt, tool, or event.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- AOI records remain empty until a real acquisition/processing pipeline publishes them through the spatial Service.
- Base-map imagery uses darkened Esri World Imagery and automatic location uses public Nominatim; both require network access.
- Source-configuration, processing, pipeline execution, and mutating Agent tools remain subsequent GSTAR capabilities; the shipped `gstar_station_data` tool is read-only.
