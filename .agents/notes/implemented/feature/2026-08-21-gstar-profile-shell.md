# Agent Note: GSTAR profile and station-workspace shell

Status: implemented

English | [中文](2026-08-21-gstar-profile-shell.zh.md)

## Problem

GSTAR needs to start as its own product surface while retaining the DSH Web Host, transport, storage, Workspace runtime, theme, locale, and client plugin loader. Treating each generated region as a Workspace loses the existing product distinction between a station and the several regions managed by that station.

## Decision

`dsh gstar` resolves a shipped `gstar` profile composed from `dsh-base`, `dsh-web-app`, and `dsh-gstar-app`. The final overlay disables the standard root occupant, sidebar, generic Workspace surface, and settings pages, then mounts `dsh-client-ui-gstar` as a distinct Client row. The standard conversation and tool-presentation rows remain active and mount into slots declared by the GSTAR root. Infrastructure rows remain shared with Web.

The GSTAR shell treats one durable DSH Workspace as one station workspace only after explicit station classification. A React-free GSTAR Client runtime reads `gstarSites.list` and supplies an immutable station store to the root component. It never derives station membership from the root slot's generic `useWorkspaces` hook. Region counts, plugin counts, and pipeline facts remain absent until their owning Host domains exist; the shell displays an unavailable value instead of embedding demonstration data.

Region assets form the provider-neutral `ctx.gstarSpatial` domain keyed by `workspaceId`, allowing one station Workspace to own several AOIs. Its snapshot combines a persisted station marker and administrative/place boundary, WGS84 Polygon/MultiPolygon AOIs, normalized entity fields, and acquisition provenance. The shipped `storage-domain` Provider filters every spatial read and write through `ctx.gstarSites`, so an ordinary Workspace cannot leak into GSTAR through the spatial path.

The GSTAR root is a three-column Client plugin: the classified station list on the left, a Cesium map in the center, and standard DSH conversation on the right. It declares `conversation`, `details`, and `shell.overlay` with the standard contracts and provides the `ctx.layout` action face over its own root viewing-state store. This preserves DSH Conversation, tool details, session logging, and Agent behavior without mounting the standard `ui-layout` root. Selecting a station calls the standard Workspace Client service to start a Session bound to that Workspace and exposes a 3D/2D projection switch. Both projections render the same Host station boundary and AOIs over the satellite layer, and each projection change refits the selected geometry.

Cesium runtime files are not hosted by a second frontend. `dsh-gstar-cesium-assets` contributes a DSH Web Host prefix route for the installed Workers, ThirdParty, Assets, and Widgets tree, while `ui-gstar` bundles the matching API and points its module base URL at that route. Cesium projects Host snapshots only over a lightly darkened satellite layer that retains road, building, and terrain detail at station scale. Stations without a committed coordinate remain explicitly unlocated. Creation requires a user-supplied station name and the standard directory flow; `gstarSpatial.locate` resolves that name through fixed-origin Nominatim and Photon requests over the Host `ctx.web` provider, persists the coordinate and available Nominatim Polygon/MultiPolygon boundary, and lets Cesium fit the selected station boundary without a browser-side map click. A high-contrast polyline frames every boundary ring; a point-only result retains the fixed-range camera fallback. The CLI applies inherited HTTP(S) proxy variables to Node's global dispatcher before Profile boot when the runtime supports dynamic proxy configuration.

The right conversation can inspect the same Host spatial snapshots through `gstar_station_data`, a read-only DSH Tool Consumer loaded only by the GSTAR Bundle. It derives station authority from the immutable calling Session cwd, never accepts a model-supplied Workspace id, returns summary data before entity arrays, and caps detailed AOI entity results. An ordinary Workspace or a Session without a station cwd is rejected.

Station identity is formalized as the provider-neutral `ctx.gstarSites` Service Definition. The shipped `dsh-gstar-site-workspace` Provider keeps a storage-domain sidecar keyed by `WorkspaceId`; a row means that the generic Workspace is classified as a GSTAR station. The Provider filters `ctx.workspaceRegistry` through those rows, delegates creation to the registry, commits membership after Workspace creation, and publishes list, create, and delete through concrete Typert Remote adapters. Deletion prepares registered station-owned Host cleanup, removes only the membership row, and compensates prepared cleanup if the membership commit fails. The spatial Provider uses that lifecycle to delete its station record while blocking racing patches. Workspace remains the authority for identity and metadata; deletion deliberately preserves the generic Workspace, directory, and Session logs for `dsh web`.

`dsh-gstar-client-remotes` selects the generated site and spatial contributions only for the `gstar` Profile and mounts them into DSH's standard Client Remote carrier. `ui-gstar` owns React-free station and spatial runtimes, injects their snapshot stores and actions into the pure root component, and refreshes after successful mutations. The generic `dsh web` assembly and its Workspace projection are unchanged.

The GSTAR root declares both standard Workspace directory-flow holes while the standard `ui-workspace` row is disabled. `directory-picker-auto` supplies the same native or browse occupant used by Web; its selected path and the required station name go to `gstarSites.create`, followed by Host-side `gstarSpatial.locate`. The picker Client manifests depend on runtime services instead of a particular hole owner, and `slots.inject()` binds their lifetime to whichever root declares the pair.

## Alternatives considered

**Host GSTAR as a standalone Web application beside DSH.** Rejected because it would duplicate the Web Host, persistence, workspace projection, permissions, and plugin loading lifecycle, and browser-local state could not serve as the authoritative GSTAR runtime.

**Fork the complete `dsh-web-app` bundle and its client shell.** Rejected because GSTAR needs the shared Host and browser infrastructure unchanged. A final overlay replaces only presentation rows, so upstream Web infrastructure remains composable and patchable.

**Represent every AOI as a DSH Workspace.** Rejected because one station owns several regions, data-source configurations, processors, and pipeline runs. Reusing Workspace for both levels would erase that ownership relation and scatter one station across several independent session containers.

## Testing

CLI tests pin the `gstar` alias and app-argument boundary. App Boot tests pin the shipped bundle order and the composed Client service topology. The GSTAR client apply test mounts the real `SlotRegistry`, verifies exclusive root ownership, loads the Host station projection, and proves disposal. Component tests prove that an ordinary Workspace supplied by the standard root runtime cannot appear in the station list. The assembled configuration remains inspectable through `dsh gstar --dump-config`.

The station Service Definition test pins service publication, disposal, and Remote delegation. The Workspace Provider test runs through a real Loader/Include composition and verifies membership filtering, registry-order projection, delegated creation, durable classification, idempotent reconnect, and domain disposal.

The GSTAR Client assembly test pins both generated contributions and reverse-order disposal. UI apply and runtime tests pin exact Remote dependencies, success/error envelope handling, refresh after creation, deletion, or spatial mutation, stale-response suppression, directory-flow declarations, standard conversation/details slots, and live occupant availability. Loader composition tests cover durable membership removal, preserved generic Workspace identity, boundary persistence, spatial cleanup compensation, and deletion admission closure. Component tests drive named station creation with a picked Host directory, automatic Host location, deletion confirmation, station selection, 3D/2D switching, AOI selection, entity-field display, and provenance display.

The spatial Service Definition test pins Remote delegation. Its storage Provider test runs through a real Loader/Include composition and proves station filtering, retained omitted fields, Nominatim-to-Photon transport failover with station-suffix normalization, location and AOI commits, rejection of generic Workspaces, serialized disposal, and domain close. CLI tests pin inherited-proxy bootstrap and its older-Node diagnostic. Cesium asset tests pin traversal protection, MIME types, immutable caching, route composition, and method rejection.

The package Model Experience audit classifies the GSTAR Bundle, UI, station/spatial Service Definitions, their Providers, the Cesium Host route, and the Client Remote assembly as model-neutral contributions.

## Consequences

The `gstar` composition boots into a real Workspace-backed three-column station surface without forking Web infrastructure or changing the generic Workspace contract. Ordinary Web Workspaces stay outside GSTAR unless a user explicitly selects their path as a station. Station markers, boundaries, AOIs, entities, and provenance are durable Host data; an absent location, boundary, or AOI publication remains visibly absent. Users can remove test stations from GSTAR without deleting their directories or DSH histories. Selecting a bounded station frames it and fits Cesium to its geometry in either 3D or 2D. The right column is the actual DSH Conversation tree, not a lookalike chat component, and its read-only station query is scoped by the calling Session. Source configuration, processing, pipeline execution, and mutating Agent tools remain separate subsequent capabilities.
