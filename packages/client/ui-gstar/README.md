# @deepseek-ai/dsh-client-ui-gstar

English | [中文](README.zh.md)

GSTAR browser root shell. It occupies the built-in `root` slot and renders a three-column station workspace: the Host-classified station list on the left, a Cesium globe in the center, and the standard DSH Conversation occupant on the right. Generic `dsh web` Workspaces do not enter the station surface.

The registering Client plugin owns React-free station and spatial runtimes backed by `gstarSites` and `gstarSpatial` Remote namespaces. Cesium projects only Host snapshots: persisted station markers and boundaries, AOI Polygon/MultiPolygon geometry, entity fields, and provenance. Selecting a station starts a DSH session for that station Workspace, draws its boundary with a high-contrast frame, fits the camera to that geometry, and lets the existing `ui-conversation` plugin render into the declared `conversation` slot. A point-only station uses a fixed-range camera fallback until its boundary is acquired.

The root entry declares the same directory-flow hole used by `dsh web` while the standard `ui-workspace` row stays absent. `directory-picker-auto` therefore supplies the native chooser or in-app Select Workspace Directory dialog unchanged. The user enters a required station name and selects the Host path; after `gstarSites.create`, `gstarSpatial.locate` resolves and persists the marker through the Host. Cesium automatically flies to the committed coordinate.

Each station card exposes an explicit delete action with a confirmation dialog. The action calls the Host `gstarSites.delete` Remote, refreshes both Host projections, and accurately states that only GSTAR classification and station-owned assets are removed; the generic DSH Workspace, directory, and Session logs remain intact.

## Model Experience

None, as the package is a browser presentation plugin and contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- AOIs appear only after a Host pipeline publishes them through `gstarSpatial.patch`; the browser does not generate sample AOIs or provenance.
- The first map Provider uses lightly darkened Esri World Imagery tiles that retain station-scale road and building detail, plus an ellipsoid terrain Provider; deployments still need their own imagery policy and offline strategy.
- The narrow conversation column reuses the complete DSH conversation tree and the read-only `gstar_station_data` tool; data mutation and pipeline-control tools are deferred.
