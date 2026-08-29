# `@deepseek-ai/dsh-gstar-spatial-storage`

English | [中文](README.zh.md)

`storage-domain` Provider for `ctx.gstarSpatial`. It opens the `gstar_spatial` domain, stores one record per station `WorkspaceId`, and filters every read and write through `ctx.gstarSites`. An ordinary `dsh web` Workspace therefore cannot acquire or expose GSTAR spatial records unless it has first been durably classified as a station.

Writes are serialized through a Provider-owned operation chain and complete before the domain closes. Omitted location, boundary, or AOI fields retain the durable value; `boundary: null` clears the current station boundary, and an empty AOI array clears the current AOI projection. The Provider participates in `gstarSites.delete`: it removes the station record before membership deletion, blocks racing patches, and supplies a durable rollback until membership removal commits.

`locate()` uses the injected DSH `ctx.web` seam to try Nominatim and then Photon, removes a trailing Chinese station suffix before falling back to the exact title, validates the returned WGS84 coordinate, and persists it through the same spatial write path. Nominatim requests simplified GeoJSON geometry; a valid Polygon/MultiPolygon becomes the station boundary, with Nominatim's bounding box as a rectangle fallback. Photon remains a marker-only availability fallback. Transport, HTTP, and malformed-payload failures fall through to the next Host provider and retain their cause chain for Remote diagnostics. The browser never performs geocoding requests directly.

`refreshAois()` builds a bounded Overpass query from the persisted station boundary, or from a configured marker radius when no boundary is available. A response that reaches the per-request element cap is treated as incomplete and recursively divided into four tiles; complete tiles are merged by stable OSM id before the station's actual Polygon/MultiPolygon boundary is applied. The Provider serializes public Overpass requests, leaves a configured interval between them, and retries HTTP 429 with bounded exponential backoff. It writes only after the complete refresh succeeds, so a rate-limit failure retains the preceding durable AOI publication. The decoder accepts closed ways and multipolygon relations, maps OSM tags into the seven GSTAR AOI categories, publishes a normalized entity per OSM feature, and records the OSM object URL, retrieval time, ODbL license, and SHA-256 checksum. `listSources()` publishes Overpass as a direct source and the National Public Data Resource Registration Platform, National Government Service Platform, National Enterprise Credit Information Publicity System, National Financial Regulatory Administration license query, Ministry of Education institution list, and National Health Commission data query as authoritative references.

## Configuration

| Field | Default | Meaning |
|---|---:|---|
| `overpassEndpoint` | `https://overpass-api.de/api/interpreter` | Direct AOI acquisition endpoint. |
| `overpassTimeoutSeconds` | `120` | Server-side Overpass timeout. |
| `overpassMaxElements` | `2000` | Per-request element cap that triggers adaptive subdivision. |
| `overpassRequestIntervalMilliseconds` | `1000` | Minimum pause after one response before another request. |
| `overpassRetryDelayMilliseconds` | `30000` | Initial HTTP 429 retry pause; later retries double it. |
| `overpassMaxRetries` | `2` | Maximum retries for one rate-limited tile request. |
| `fallbackRadiusMeters` | `15000` | Marker search radius when no station boundary is available. |

## Model Experience

None, as the Provider contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The current KV record stores only the latest spatial projection and does not retain data-version history.
- Large entity collections remain inline with each station record; object storage and indexed spatial databases are future Providers behind the same Service Definition.
- Authorization is limited to durable station membership rather than an authenticated user policy.
- Public Nominatim, Photon, and Overpass availability and usage policies remain external deployment dependencies; production deployments can replace this Provider behind the same Service Definition.
- Official reference sources have heterogeneous access controls and response formats; this Provider catalogs them for validation but does not represent them as directly ingested records.
