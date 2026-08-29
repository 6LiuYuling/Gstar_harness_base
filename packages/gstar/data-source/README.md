# `@deepseek-ai/dsh-gstar-data-source`

English | [中文](README.zh.md)

Provider-neutral GSTAR data-source Service Definition on `ctx.gstarDataSources`. Source packages register one stable descriptor and an optional synchronization operation for their Cordis lifetime. The active Provider projects only loaded contributions, so adding, removing, or reloading a source row changes the live catalog without changing the spatial service or browser shell.

`list({ workspaceId })` combines the live plugin registry with that station's effective selection. `setEnabled({ workspaceId, sourceId, enabled })` stores an explicit station override. `synchronize({ workspaceId, sourceId })` executes only a loaded, enabled direct source; reference sources have no acquisition operation and fail closed when called as one. The Service Definition owns Remote adapters, while a Provider owns durable selections and station-membership validation.

`GstarDataSourceDescriptor` separates access mode from capability. A direct source may publish AOIs or entities; a reference source documents authoritative verification inputs. `defaultEnabled` applies until a station stores an override, and `synchronizable` in the browser snapshot reflects the loaded plugin's executable contribution rather than configuration text.

## Model Experience

None, as the source-management service registers no tool, prompt section, Session event, or other model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Enablement is station-scoped but not actor-scoped; deployments must keep the Host gateway within their authorization boundary.
- Synchronization reports completion after one source commits, but cross-source transactions and versioned pipeline runs are separate capabilities.
- A stored override for an unloaded source remains durable but is omitted from `list()` until that source plugin is loaded again.
