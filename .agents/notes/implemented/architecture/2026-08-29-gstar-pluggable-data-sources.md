# Agent Note: GSTAR pluggable data-source registry

Status: implemented

English | [中文](2026-08-29-gstar-pluggable-data-sources.zh.md)

## Problem

GSTAR stations need different combinations of public data. A source catalog owned by the spatial Provider can describe sources, but it cannot express dynamic plugin lifetime, per-station admission, or source-specific execution without coupling geometry storage to every connector. A browser calling spatial acquisition directly can also bypass a station's source switch.

Public sources have different authority and execution shapes. OpenStreetMap supplies geometry, official government platforms are high-confidence verification references, and AKShare exposes structured listed-company data from upstream publishers. Treating all of them as one acquisition method would either claim ingestion that does not exist or erase the provenance and geographic checks required for enterprise data.

## Decision

`ctx.gstarDataSources` is the single live registry and station-configuration capability. Each source is an ordinary Cordis plugin contribution with a stable id, publisher metadata, covered AOI categories, capabilities, access mode, default enablement, and an optional synchronization operation. The storage Provider projects only loaded contributions and combines them with durable boolean overrides keyed by station `WorkspaceId`.

Direct sources carry a synchronization operation; reference sources never do. The manager rejects unloaded, disabled, and reference-only execution before it calls a connector. Plugin effect disposal removes the exact live contribution, while a stored override remains available if the same source id is loaded again. Station deletion removes the override record through the existing deletion-preparation and rollback contract.

The browser mounts the generated `gstarDataSources` Remote and loads source state for the selected station. Its manager edits station-specific switches and offers synchronization only for enabled executable sources. OpenStreetMap AOI refresh remains a Host spatial operation for the OSM plugin to reuse, but it is absent from the spatial browser Remote; browser acquisition therefore crosses the source policy boundary.

The GSTAR Profile loads OpenStreetMap as a default-enabled direct AOI/entity plugin, AKShare as a default-disabled direct entity plugin, and each official platform as an independently configured reference-plugin row. A higher Profile layer can remove, add, or replace those rows without changing the registry or UI.

AKShare enriches existing enterprise or financial AOIs rather than creating geometry. Its bounded Python bridge matches A-share names against AOI names and aliases, retrieves the corresponding CNInfo company profile, and accepts a record only when its registered or office address contains all usable city and district tokens from the station title. One complete spatial patch adds a `listed_company` entity and source provenance after bridge validation. The connector does not merge a group parent with a listed subsidiary or admit an address from a neighboring district.

## Alternatives considered

**Keep the catalog and OSM refresh on `gstarSpatial`.** Rejected because a geometry Provider would remain the policy owner for unrelated enterprise and official sources, while browser callers could execute acquisition without checking a station selection.

**Store one global enabled-source list.** Rejected because station coverage, licensing decisions, and desired enrichment differ. The durable identity is already the station `WorkspaceId`, so the override belongs there.

**Build one monolithic connector with a source-type switch.** Rejected because adding or unloading a source would require editing the central connector and redeploying every source dependency. Independent Cordis rows provide the dynamic lifetime already used by the Harness.

**Treat every official platform as a direct source.** Rejected because a public link and high institutional credibility do not prove that an automated, licensed connector exists. Reference mode represents verification value without claiming ingestion.

**Use AKShare to discover and place every listed company.** Rejected because company profiles do not supply trustworthy AOI geometry and name-only placement crosses administrative boundaries. AKShare augments a spatially acquired AOI only after station-address validation.

## Verification

Service and Loader-composition tests cover Remote delegation, live source registration, default and overridden enablement, station rejection, disabled and reference-only execution, OSM delegation, deletion rollback, and disposal. Source tests cover reference URL validation, OSM summaries, AKShare subprocess bounds, output validation, no-partial-write failures, entity provenance, and missing station or spatial projections. Client tests cover three Remote mounts, station-aware stale-load protection, toggle and synchronization errors, OSM policy routing, and the source-manager controls.

## Consequences

GSTAR gains source-level extensibility and per-station control without expanding the spatial contract for each connector. New sources pay the cost of a package, descriptor, synchronization boundary, tests, and deployment configuration rather than a central switch branch.

Reference enablement currently records policy intent only; it does not scrape a platform. Cross-source reconciliation and versioned pipeline transactions remain outside the registry. Direct plugins own their external rate limits and publication atomicity, so the manager can enforce admission but cannot make several source commits one transaction.

AKShare requires a separately managed Python environment and inherits upstream availability and field freshness. Its output retains source provenance and geographic filtering, but deployment review and sample verification remain necessary before company fields support decisions.
