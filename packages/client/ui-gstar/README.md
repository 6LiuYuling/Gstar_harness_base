# @deepseek-ai/dsh-client-ui-gstar

English | [中文](README.zh.md)

GSTAR browser root shell. It occupies the built-in `root` slot and renders a three-column station workspace: the Host-classified station list on the left, a Cesium globe in the center, and the standard DSH Conversation occupant on the right. Generic `dsh web` Workspaces do not enter the station surface.

The registering Client plugin owns React-free station and spatial runtimes backed by `gstarSites` and `gstarSpatial` Remote namespaces. Cesium projects only Host snapshots: persisted station markers, AOI Polygon/MultiPolygon geometry, entity fields, and provenance. Selecting a station starts a DSH session for that station Workspace and lets the existing `ui-conversation` plugin render into the declared `conversation` slot.

The root entry declares the same directory-flow hole used by `dsh web` while the standard `ui-workspace` row stays absent. `directory-picker-auto` therefore supplies the native chooser or in-app Select Workspace Directory dialog unchanged. The selected Host path goes to `gstarSites.create`; a newly classified station then enters globe-location mode rather than inventing coordinates.

## Model Experience

None, as the package is a browser presentation plugin and contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- AOIs appear only after a Host pipeline publishes them through `gstarSpatial.patch`; the browser does not generate sample AOIs or provenance.
- The first map Provider uses network OpenStreetMap tiles and an ellipsoid terrain Provider; deployments still need their own imagery policy and offline strategy.
- The narrow conversation column reuses the complete DSH conversation tree and the read-only `gstar_station_data` tool; data mutation and pipeline-control tools are deferred.
