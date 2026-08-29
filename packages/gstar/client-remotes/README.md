# `@deepseek-ai/dsh-gstar-client-remotes`

English | [中文](README.zh.md)

GSTAR-only extension of the standard DSH Client Remote assembly. Its browser half mounts the generated `dsh-gstar-site/remote`, `dsh-gstar-spatial/remote`, and `dsh-gstar-data-source/remote` contributions into the existing `ctx.remote` carrier. The package is present only in the `gstar-app` Bundle, so `dsh web` does not acquire GSTAR namespaces.

Consumers inject both `remote` and the exact namespace service they use, such as `remote.gstarSites`. The Typert carrier owns request envelopes, codecs, publication, and disposal; this package only selects the GSTAR contribution for the product Profile.

## Model Experience

None, as the assembly selects browser Remote namespaces and registers no prompt, tool, Session event, or other model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Processor and versioned pipeline namespaces join here when their Host Service Definitions exist.
- The package forwards no Host events; station, spatial, and source-selection freshness use explicit Remote loads.
