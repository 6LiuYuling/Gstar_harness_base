# `@deepseek-ai/dsh-gstar-site`

English | [中文](README.zh.md)

Provider-neutral GSTAR station Service Definition on `ctx.gstarSites`. A station uses the durable `WorkspaceId` as its identity, so every later GSTAR region, source configuration, processor, and pipeline run can share one stable owner without changing the generic Workspace record.

`list()` returns immutable station snapshots in the active Workspace provider's durable order. `create({ path, title? })` resolves or creates the station through that provider; the directory validation and path canonicalization rules belong to the provider. The Remote adapters publish the same operations as `gstarSites.list` and `gstarSites.create` for a Host-backed client assembly.

`GstarSiteSnapshot.updatedAt` is the Workspace metadata mutation time. It is not the GSTAR data-refresh time; a pipeline domain owns `lastSuccessfulUpdateAt` after a successful published data version.

## Model Experience

None, as the station service registers no tool, prompt section, Session event, or other model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The shipped Workspace provider requires an existing Host directory and has no browser-facing directory workflow in the GSTAR shell yet.
- The Host Remote contract exists, but the GSTAR Client Remote assembly and UI consumer are separate packages.
- The service carries no authenticated actor or station-level authorization policy; deployments must keep the Host gateway inside a trusted boundary.
