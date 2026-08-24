# Agent Note: GSTAR profile and station-workspace shell

Status: implemented

English | [中文](2026-08-21-gstar-profile-shell.zh.md)

## Problem

GSTAR needs to start as its own product surface while retaining the DSH Web Host, transport, storage, Workspace runtime, theme, locale, and client plugin loader. Treating each generated region as a Workspace loses the existing product distinction between a station and the several regions managed by that station.

## Decision

`dsh gstar` resolves a shipped `gstar` profile composed from `dsh-base`, `dsh-web-app`, and `dsh-gstar-app`. The final overlay disables the standard root occupant, mounts `dsh-client-ui-gstar` as a distinct Client row, and disables presentation rows whose slots belong to the standard chat shell. Infrastructure rows remain shared with Web.

The GSTAR shell treats one durable DSH Workspace as one station workspace only after explicit station classification. A React-free GSTAR Client runtime reads `gstarSites.list` and supplies an immutable station store to the root component. It never derives station membership from the root slot's generic `useWorkspaces` hook. Region counts, plugin counts, and pipeline facts remain absent until their owning Host domains exist; the shell displays an unavailable value instead of embedding demonstration data.

Region assets form a separate domain keyed by `workspaceId`, allowing one station Workspace to own several AOIs. Agent conversation later returns through a GSTAR-owned slot, so GSTAR does not depend on the standard layout's private slot tree.

Station identity is formalized as the provider-neutral `ctx.gstarSites` Service Definition. The shipped `dsh-gstar-site-workspace` Provider keeps a storage-domain sidecar keyed by `WorkspaceId`; a row means that the generic Workspace is classified as a GSTAR station. The Provider filters `ctx.workspaceRegistry` through those rows, delegates creation to the registry, commits membership after Workspace creation, and publishes `gstarSites.list` and `gstarSites.create` through concrete Typert Remote adapters. Workspace remains the authority for identity and metadata; the sidecar stores membership only.

`dsh-gstar-client-remotes` selects the generated site contribution only for the `gstar` Profile and mounts it into DSH's standard Client Remote carrier. `ui-gstar` owns the React-free station runtime: it loads `ctx.remote.gstarSites.list`, injects its snapshot store and a `createSite` action into the pure root component, and refreshes after successful creation. The generic `dsh web` assembly and its Workspace projection are unchanged.

## Alternatives considered

**Host GSTAR as a standalone Web application beside DSH.** Rejected because it would duplicate the Web Host, persistence, workspace projection, permissions, and plugin loading lifecycle, and browser-local state could not serve as the authoritative GSTAR runtime.

**Fork the complete `dsh-web-app` bundle and its client shell.** Rejected because GSTAR needs the shared Host and browser infrastructure unchanged. A final overlay replaces only presentation rows, so upstream Web infrastructure remains composable and patchable.

**Represent every AOI as a DSH Workspace.** Rejected because one station owns several regions, data-source configurations, processors, and pipeline runs. Reusing Workspace for both levels would erase that ownership relation and scatter one station across several independent session containers.

## Testing

CLI tests pin the `gstar` alias and app-argument boundary. App Boot tests pin the shipped bundle order and the composed Client service topology. The GSTAR client apply test mounts the real `SlotRegistry`, verifies exclusive root ownership, loads the Host station projection, and proves disposal. Component tests prove that an ordinary Workspace supplied by the standard root runtime cannot appear in the station list. The assembled configuration remains inspectable through `dsh gstar --dump-config`.

The station Service Definition test pins service publication, disposal, and Remote delegation. The Workspace Provider test runs through a real Loader/Include composition and verifies membership filtering, registry-order projection, delegated creation, durable classification, idempotent reconnect, and domain disposal.

The GSTAR Client assembly test pins generated contribution mount/disposal. UI apply and runtime tests pin exact Remote dependencies, success/error envelope handling, refresh after creation, and stale-response suppression; the component test drives the injected station-create action through the inline form.

The package Model Experience audit classifies the GSTAR Bundle, UI, Service Definition, Workspace Provider, and Client Remote assembly as model-neutral contributions.

## Consequences

The `gstar` composition boots into a real Workspace-backed station surface without forking Web infrastructure or changing the generic Workspace contract. Ordinary Web Workspaces stay outside GSTAR unless a user explicitly connects their path as a station; Workspaces created before the membership sidecar remain unclassified until that action occurs. Product navigation can land before each data-plane service, while each unavailable domain stays explicit. The temporary cost is that source, gate, and pipeline navigation still show service placeholders, and the create form accepts a Host path until the directory-picker contribution is mounted.
