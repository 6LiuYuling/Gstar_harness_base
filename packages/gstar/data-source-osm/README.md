# `@deepseek-ai/dsh-gstar-data-source-osm`

English | [中文](README.zh.md)

Dynamically loadable OpenStreetMap source plugin for GSTAR. It registers `osm-overpass` as an enabled-by-default direct source with AOI and entity capabilities. Synchronization delegates to the Host spatial Provider's bounded Overpass acquisition and reports the committed AOI count.

The spatial Provider continues to own query bounds, station-boundary intersection, tiling, rate-limit retry, OSM decoding, and the all-or-nothing AOI replacement. This package owns only source identity, catalog metadata, dynamic lifetime, and the policy-controlled execution entry point. Removing its Cordis row removes OSM from the live source registry and prevents browser synchronization through `gstarDataSources`.

## Model Experience

None, as the OSM source plugin registers no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The shipped source uses the public Overpass endpoint configured on `dsh-gstar-spatial-storage`; deployments should supply an appropriate endpoint and usage policy.
- Nominatim and Photon geocoding remain spatial Provider concerns and are not selectable through this source plugin.
- OSM synchronization replaces the current OSM AOI publication; multi-source entity reconciliation remains source-specific.
