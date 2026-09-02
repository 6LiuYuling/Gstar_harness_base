# `@deepseek-ai/dsh-gstar-data-source-storage`

English | [中文](README.zh.md)

`storage-domain` Provider for [`ctx.gstarDataSources`](../data-source/README.md). It owns the live source-provider registry and one durable override record per classified station. Plugin effects add and remove exact registry contributions; duplicate source ids and invalid direct/reference operation shapes fail during registration.

The Provider verifies GSTAR station membership before reads and synchronization. Selection writes are serialized with station deletion. A station deletion preparation removes its source overrides before membership commits and can restore the complete record on rollback. Provider disposal closes admission, drains accepted writes, and then closes the `gstar_data_sources` domain.

Synchronization resolves the provider and effective enablement immediately before execution. Disabled, unloaded, and reference-only sources reject without invoking acquisition. Source plugins own their publication transaction; this Provider returns their summary and stamps the completion time only after the operation resolves.

## Model Experience

None, as the storage Provider persists product configuration and registers no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Domain version `0` stores boolean overrides only; schedules, credentials, and source-specific options stay in their owning plugin configuration.
- One process owns the live registry; distributed source orchestration requires a separate coordination design.
- Synchronizations are not globally serialized, so each source plugin must protect its own external rate and commit boundaries.
