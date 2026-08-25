# `@deepseek-ai/dsh-gstar-spatial`

English | [中文](README.zh.md)

Provider-neutral GSTAR spatial Service Definition on `ctx.gstarSpatial`. It keeps station location, published AOI geometry, normalized entity fields, and acquisition provenance behind a Host capability keyed by the station's durable `WorkspaceId`. The browser receives typed snapshots through generated Typert Remote adapters; Cesium is only a projection consumer and never becomes the business-data authority.

`list()` returns one spatial snapshot per classified station. `locate({ workspaceId, query })` asks the active Host Provider to resolve the user-supplied station name and persist its marker. `patch({ workspaceId, location?, aois? })` retains omitted fields, so automatic station location and pipeline AOI publication can commit independently. AOIs accept WGS84 Polygon or MultiPolygon geometry and carry their entity fields and provenance records in the same publication snapshot.

## Model Experience

None, as the spatial service registers no tool, prompt section, Session event, or other model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- AOI publication currently replaces the complete station AOI collection; data-version lineage and partial AOI mutation belong to the future pipeline domain.
- The contract carries no authenticated actor or station-level authorization policy.
- Provenance records are typed snapshots but are not yet signed or independently attested.
