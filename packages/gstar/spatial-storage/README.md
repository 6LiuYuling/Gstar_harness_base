# `@deepseek-ai/dsh-gstar-spatial-storage`

English | [中文](README.zh.md)

`storage-domain` Provider for `ctx.gstarSpatial`. It opens the `gstar_spatial` domain, stores one record per station `WorkspaceId`, and filters every read and write through `ctx.gstarSites`. An ordinary `dsh web` Workspace therefore cannot acquire or expose GSTAR spatial records unless it has first been durably classified as a station.

Writes are serialized through a Provider-owned operation chain and complete before the domain closes. Omitted location or AOI fields retain the durable value; an empty AOI array is an explicit publication that clears the current AOI projection.

`locate()` uses the injected DSH `ctx.web` seam to try Nominatim and then Photon, removes a trailing Chinese station suffix before falling back to the exact title, validates the returned WGS84 coordinate, and persists it through the same spatial write path. Transport, HTTP, and malformed-payload failures fall through to the next Host provider and retain their cause chain for Remote diagnostics. The browser never performs geocoding requests directly.

## Model Experience

None, as the Provider contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The current KV record stores only the latest spatial projection and does not retain data-version history.
- Large entity collections remain inline with each station record; object storage and indexed spatial databases are future Providers behind the same Service Definition.
- Authorization is limited to durable station membership rather than an authenticated user policy.
- Public Nominatim and Photon availability and usage policies remain external deployment dependencies; production deployments can replace this Provider behind the same Service Definition.
