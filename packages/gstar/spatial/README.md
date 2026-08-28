# `@deepseek-ai/dsh-gstar-spatial`

English | [中文](README.zh.md)

Provider-neutral GSTAR spatial Service Definition on `ctx.gstarSpatial`. It keeps station location, administrative/place boundary, published AOI geometry, normalized entity fields, and acquisition provenance behind a Host capability keyed by the station's durable `WorkspaceId`. The browser receives typed snapshots through generated Typert Remote adapters; Cesium is only a projection consumer and never becomes the business-data authority.

`list()` returns one spatial snapshot per classified station. `locate({ workspaceId, query })` asks the active Host Provider to resolve the user-supplied station name and persist its marker and available Polygon/MultiPolygon boundary. `refreshAois({ workspaceId })` asks the Provider to acquire and replace that station's current public AOI publication. `listSources()` distinguishes directly acquired sources from authoritative reference sources. `patch({ workspaceId, location?, boundary?, aois? })` retains omitted fields; `boundary: null` explicitly clears a stale boundary. AOIs use the product categories 政, 企, 金融, 教育, 医疗, 商场, and 居民区, accept WGS84 Polygon or MultiPolygon geometry, and carry entity fields and provenance in the same publication snapshot.

## Model Experience

None, as the spatial service registers no tool, prompt section, Session event, or other model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- AOI refresh and publication replace the complete station AOI collection; data-version lineage and partial AOI mutation belong to the future pipeline domain.
- Reference-source descriptors do not claim automated ingestion; source-specific connectors remain independent Providers or pipeline plugins.
- The contract carries no authenticated actor or station-level authorization policy.
- Provenance records are typed snapshots but are not yet signed or independently attested.
