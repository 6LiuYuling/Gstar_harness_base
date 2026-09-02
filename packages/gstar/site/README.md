# `@deepseek-ai/dsh-gstar-site`

English | [中文](README.zh.md)

Provider-neutral GSTAR station Service Definition on `ctx.gstarSites`. A station uses the durable `WorkspaceId` as its identity, so every later GSTAR region, source configuration, processor, and pipeline run can share one stable owner without changing the generic Workspace record.

`list()` returns immutable station snapshots in the active Workspace provider's durable order. `create({ path, title })` resolves or creates the station through that provider; the user-supplied title is required and later drives Host-side geocoding. `delete({ workspaceId })` removes GSTAR classification and station-owned domain data while deliberately retaining the generic Workspace, directory, and Session logs. Directory validation and path canonicalization rules belong to the provider. Remote adapters publish all three operations for a Host-backed client assembly.

Station-owned Host Providers register deletion preparations with `gstarSites`. The service prepares every durable cleanup before membership removal, rolls them back in reverse order if a later preparation or membership commit fails, and finalizes transient guards only after deletion succeeds. This keeps deletion orchestration inside the DSH Host rather than sequencing business writes in React.

`GstarSiteSnapshot.updatedAt` is the Workspace metadata mutation time. It is not the GSTAR data-refresh time; a pipeline domain owns `lastSuccessfulUpdateAt` after a successful published data version.

## Model Experience

None, as the station service registers no tool, prompt section, Session event, or other model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The shipped Workspace provider requires an existing Host directory; the GSTAR shell reaches it through DSH's standard directory-picker composition.
- The Host Remote contract exists, but the GSTAR Client Remote assembly and UI consumer are separate packages.
- The service carries no authenticated actor or station-level authorization policy; deployments must keep the Host gateway inside a trusted boundary.
