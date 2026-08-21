# Agent Note: GSTAR profile and station-workspace shell

Status: implemented

English | [中文](2026-08-21-gstar-profile-shell.zh.md)

## Problem

GSTAR needs to start as its own product surface while retaining the DSH Web Host, transport, storage, Workspace runtime, theme, locale, and client plugin loader. Treating each generated region as a Workspace loses the existing product distinction between a station and the several regions managed by that station.

## Decision

`dsh gstar` resolves a shipped `gstar` profile composed from `dsh-base`, `dsh-web-app`, and `dsh-gstar-app`. The final overlay replaces the standard root occupant with `dsh-client-ui-gstar` and disables presentation rows whose slots belong to the standard chat shell. Infrastructure rows remain shared with Web.

The GSTAR shell treats one durable DSH Workspace as one station workspace. It reads the existing React-free Workspace projection through the root slot's standard `useWorkspaces` hook. Region counts, plugin counts, and pipeline facts remain absent until their owning Host domains exist; the shell displays an unavailable value instead of embedding demonstration data.

Region assets form a separate domain keyed by `workspaceId`, allowing one station Workspace to own several AOIs. Agent conversation later returns through a GSTAR-owned slot, so GSTAR does not depend on the standard layout's private slot tree.

## Alternatives considered

**Host GSTAR as a standalone Web application beside DSH.** Rejected because it would duplicate the Web Host, persistence, workspace projection, permissions, and plugin loading lifecycle, and browser-local state could not serve as the authoritative GSTAR runtime.

**Fork the complete `dsh-web-app` bundle and its client shell.** Rejected because GSTAR needs the shared Host and browser infrastructure unchanged. A final overlay replaces only presentation rows, so upstream Web infrastructure remains composable and patchable.

**Represent every AOI as a DSH Workspace.** Rejected because one station owns several regions, data-source configurations, processors, and pipeline runs. Reusing Workspace for both levels would erase that ownership relation and scatter one station across several independent session containers.

## Testing

CLI tests pin the `gstar` alias and app-argument boundary. App Boot tests pin the shipped bundle order. The GSTAR client apply test mounts the real `SlotRegistry`, verifies exclusive root ownership, and proves disposal; component tests project Workspace snapshots and navigation copy without fabricated domain records. The assembled configuration remains inspectable through `dsh gstar --dump-config`.

## Consequences

The first `gstar` composition boots into a real Workspace-backed station surface without forking Web infrastructure or changing the generic Workspace contract. Product navigation can land before each data-plane service, while each unavailable domain stays explicit. The temporary cost is that source, gate, and pipeline navigation show service placeholders and Workspace creation remains disabled until station-profile creation can be atomic.
