# GSTAR stations and data sources

English | [中文](gstar.zh.md)

GSTAR classifies selected DSH Workspaces as stations. Each station owns a spatial projection containing a WGS84 location, an optional administrative boundary, typed AOI polygons, entity attributes, and immutable source provenance. Deleting a station removes only GSTAR-owned records; the underlying Workspace and Sessions remain.

Data acquisition is a separate, dynamically composed layer. A source plugin registers metadata and, for direct sources, a synchronization operation with `ctx.gstarDataSources`. The storage provider persists only per-station enablement overrides, so loading or unloading a source plugin immediately changes the live catalog without rewriting station records. Synchronization is rejected when a source is disabled, reference-only, or no longer loaded.

The default Profile composes OpenStreetMap as the enabled AOI source and AKShare as an optional listed-company enrichment source. Official government platforms are loaded as disabled reference sources for verification because they do not expose one uniform machine-readable acquisition contract. Every published AOI or enrichment retains its underlying source identity and retrieval time.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxgstardatasources--gstardatasourceservice-abstract-seam"></a>

### `ctx.gstarDataSources` — `GstarDataSourceService` (abstract seam)

Provider-neutral source registry, durable selection, and Host Remote adapter.

```ts cordis-catalog
/**
 * Register one source plugin until its Cordis effect is disposed.
 * @param provider - Source metadata and optional synchronization operation.
 * @returns disposer that removes the exact live contribution.
 */
abstract register(provider: GstarDataSourceProvider): () => void

/**
 * List loaded source plugins with effective enablement for one station.
 * @param request - Classified station whose configuration is projected.
 * @returns immutable source snapshots ordered by stable source id.
 */
abstract list(request: GstarDataSourceListRequest): Promise<readonly GstarDataSourceSnapshot[]>

/**
 * Persist one station's enablement override for a loaded source plugin.
 * @param request - Station, loaded source id, and effective enablement.
 * @returns the updated source snapshot.
 */
abstract setEnabled(request: GstarDataSourceSetEnabledRequest): Promise<GstarDataSourceSnapshot>

/**
 * Execute one enabled direct source plugin.
 * @param request - Station and loaded source id to run.
 * @returns completion metadata after the source commits successfully.
 */
abstract synchronize( request: GstarDataSourceSynchronizeRequest, ): Promise<GstarDataSourceSynchronizationSnapshot>

/**
 * Remote adapter for {@link list}.
 * @param request - Classified station whose loaded sources are projected.
 * @returns immutable source snapshots with effective station enablement.
 */
@Remote('list') remoteExportList(request: GstarDataSourceListRequest): Promise<readonly GstarDataSourceSnapshot[]>

/**
 * Remote adapter for {@link setEnabled}.
 * @param request - Station, loaded source id, and effective enablement.
 * @returns the updated source snapshot.
 */
@Remote('setEnabled') remoteExportSetEnabled(request: GstarDataSourceSetEnabledRequest): Promise<GstarDataSourceSnapshot>

/**
 * Remote adapter for {@link synchronize}.
 * @param request - Station and enabled direct source to execute.
 * @returns completion metadata after the source commits successfully.
 */
@Remote('synchronize') remoteExportSynchronize( request: GstarDataSourceSynchronizeRequest, ): Promise<GstarDataSourceSynchronizationSnapshot>
```

Source: [`packages/gstar/data-source/src/index.ts`](../../packages/gstar/data-source/src/index.ts)

<a id="ctxgstarsites--gstarsiteservice-abstract-seam"></a>

### `ctx.gstarSites` — `GstarSiteService` (abstract seam)

Provider-neutral GSTAR station service and its Host Remote adapter.

```ts cordis-catalog
/**
 * List every station in the Workspace registry's durable order.
 * @returns immutable GSTAR station snapshots.
 */
abstract list(): Promise<readonly GstarSiteSnapshot[]>

/**
 * Create or resolve a station through the active Workspace provider.
 * @param request - Existing directory and optional first-create title.
 * @returns the durable station snapshot.
 */
abstract create(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot>

/**
 * Remove a station's GSTAR classification and station-owned domain data.
 * The generic Workspace, directory, and Session logs remain available to `dsh web`.
 * @param request - Classified station Workspace identity.
 * @returns the removed station snapshot.
 */
abstract delete(request: GstarSiteDeleteRequest): Promise<GstarSiteSnapshot>

/**
 * Register a Host-side cleanup participant for station deletion.
 * @param participant - Durable cleanup returning an optional compensating rollback.
 * @returns disposer that removes the participant from future deletions.
 */
registerDeletionParticipant(participant: GstarSiteDeletionParticipant): () => void

/**
 * Remote adapter for {@link list}; decorators cannot annotate abstract methods.
 * @returns immutable GSTAR station snapshots.
 */
@Remote('list') remoteExportList(): Promise<readonly GstarSiteSnapshot[]>

/**
 * Remote adapter for {@link create}; decorators cannot annotate abstract methods.
 * @param request - Existing directory and optional first-create title.
 * @returns the durable station snapshot.
 */
@Remote('create') remoteExportCreate(request: GstarSiteCreateRequest): Promise<GstarSiteSnapshot>

/**
 * Remote adapter for {@link delete}; decorators cannot annotate abstract methods.
 * @param request - Classified station Workspace identity.
 * @returns the removed station snapshot.
 */
@Remote('delete') remoteExportDelete(request: GstarSiteDeleteRequest): Promise<GstarSiteSnapshot>
```

Source: [`packages/gstar/site/src/index.ts`](../../packages/gstar/site/src/index.ts)

<a id="ctxgstarspatial--gstarspatialservice-abstract-seam"></a>

### `ctx.gstarSpatial` — `GstarSpatialService` (abstract seam)

Provider-neutral GSTAR spatial service and its Host Remote adapter.

```ts cordis-catalog
/**
 * List spatial projections for the requested station roster.
 * @returns one immutable projection per classified station, in station order.
 */
abstract list(): Promise<readonly GstarSpatialSnapshot[]>

/**
 * Patch location, station boundary, or AOIs and retain every omitted field.
 * @param request - Spatial fields to commit for one station.
 * @returns the committed immutable projection.
 */
abstract patch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot>

/**
 * Resolve a user-supplied station name and persist its marker and available boundary.
 * @param request - Station identity and geocoding query.
 * @returns the committed immutable spatial projection.
 */
abstract locate(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot>

/**
 * Fetch current public AOIs for one station and replace its durable AOI publication.
 * @param request - Station identity whose resolved boundary or marker defines the query area.
 * @returns the committed immutable spatial projection.
 */
abstract refreshAois(request: GstarSpatialRefreshAoisRequest): Promise<GstarSpatialSnapshot>

/**
 * Remote adapter for {@link list}.
 * @returns immutable station spatial projections.
 */
@Remote('list') remoteExportList(): Promise<readonly GstarSpatialSnapshot[]>

/**
 * Remote adapter for {@link patch}.
 * @param request - Spatial fields to commit for one station.
 * @returns the committed spatial snapshot.
 */
@Remote('patch') remoteExportPatch(request: GstarSpatialPatchRequest): Promise<GstarSpatialSnapshot>

/**
 * Remote adapter for {@link locate}.
 * @param request - Station identity and location query.
 * @returns the committed spatial snapshot.
 */
@Remote('locate') remoteExportLocate(request: GstarSpatialLocateRequest): Promise<GstarSpatialSnapshot>
```

Source: [`packages/gstar/spatial/src/index.ts`](../../packages/gstar/spatial/src/index.ts)
<!-- END GENERATED cordis-surface -->
