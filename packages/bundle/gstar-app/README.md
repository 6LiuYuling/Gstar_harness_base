# @deepseek-ai/dsh-gstar-app

English | [中文](README.zh.md)

Profile overlay composed after `dsh-web-app`. It keeps the Web Host and Client infrastructure while disabling only the standard root layout, sidebar, generic Workspace UI, and settings pages. `dsh-client-ui-gstar` owns the root and declares a three-column station shell; the standard DSH conversation and tool-presentation rows remain active and mount into GSTAR's right-hand slots.

The overlay mounts the Workspace-backed station Provider, the `storage-domain` spatial and source-selection Providers, a fixed-origin Host HTTP Provider sized for bounded Overpass responses, the Cesium asset Host route, and the GSTAR-only Client Remote assembly. `ctx.gstarSites` exposes only Workspaces with durable GSTAR membership; `ctx.gstarSpatial` resolves and persists station-name locations and owns AOI geometry, entities, and provenance; `ctx.gstarDataSources` composes loaded source plugins with per-station switches. Ordinary `dsh web` Workspaces stay outside these GSTAR projections.

OpenStreetMap is an enabled-by-default direct AOI source. AKShare is a disabled-by-default direct listed-company enrichment source and requires the configured Python environment to contain `akshare`. Six official platforms are independent reference-plugin rows for government, enterprise, finance, education, and medical verification. Any row can be removed or replaced by a higher Profile layer without changing the source manager.

The GSTAR root declares the standard Workspace directory-flow holes while `ui-workspace` is disabled. The shared `directory-picker-auto` row can therefore mount its native or browse interaction unchanged; a selected directory is classified through `gstarSites.create` instead of a GSTAR-specific filesystem UI.

## Run from source

From the repository root, run `pnpm install`, `pnpm run build`, then `pnpm dsh gstar`. The application listens on `http://127.0.0.1:3080` by default. `pnpm dsh gstar --dump-config` prints the composed `base` → `web-app` → `gstar-app` tree without starting the Host.

## Model Experience

None, as this package changes the browser composition but registers no model-visible prompt, tool, or event.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Base-map imagery uses lightly darkened Esri World Imagery that retains station-scale detail, automatic location uses public Nominatim with Photon failover, and AOI acquisition uses public Overpass; all require network access.
- Official reference plugins do not scrape their platforms; authenticated source-specific connectors, processing, versioned pipeline execution, and mutating Agent tools remain separate GSTAR capabilities. The shipped `gstar_station_data` tool is read-only.
