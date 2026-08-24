# `@deepseek-ai/dsh-gstar-site-workspace`

English | [中文](README.zh.md)

DSH Workspace-backed provider for `ctx.gstarSites`. A storage-domain sidecar records which generic Workspace ids were explicitly connected as GSTAR stations. `list()` filters the Workspace registry through that durable membership and preserves registry order, so ordinary `dsh web` Workspaces never appear in `dsh gstar`. Station creation delegates to `ctx.workspaceRegistry.create` and then commits membership, so repeated canonical paths reuse the same Workspace identity.

The membership sidecar stores no copied Workspace metadata. DSH Workspace remains the authoritative station identity and metadata source; station-owned GSTAR domains refer to it through `workspaceId`. Connecting an existing ordinary Workspace explicitly classifies that same identity as a GSTAR station without changing the generic Workspace record.

## Model Experience

None, as the Provider contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Creation inherits the Workspace requirement that the target directory already exists on the Host.
- Workspaces created before durable station membership existed remain unclassified until they are explicitly connected through GSTAR.
- Workspace title and metadata timestamps are station metadata only; GSTAR data-version timestamps belong to the pipeline domain.
