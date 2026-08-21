# `@deepseek-ai/dsh-gstar-site-workspace`

English | [中文](README.zh.md)

DSH Workspace-backed provider for `ctx.gstarSites`. It treats each durable Workspace as one GSTAR station, preserves the registry order, and copies entity getters into immutable JSON-compatible snapshots. Station creation delegates to `ctx.workspaceRegistry.create`, so repeated canonical paths reuse the same Workspace identity.

The provider owns no second station table and never copies Workspace records into browser storage. DSH Workspace remains the authoritative station identity and metadata source; station-owned GSTAR domains refer to it through `workspaceId`.

## Model Experience

None. The provider contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Creation inherits the Workspace requirement that the target directory already exists on the Host.
- Workspace title and metadata timestamps are station metadata only; GSTAR data-version timestamps belong to the pipeline domain.
