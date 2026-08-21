# `@deepseek-ai/dsh-gstar-client-remotes`

English | [中文](README.zh.md)

GSTAR-only extension of the standard DSH Client Remote assembly. Its browser half mounts the generated `dsh-gstar-site/remote` contribution into the existing `ctx.remote` carrier. The package is present only in the `gstar-app` Bundle, so `dsh web` does not acquire GSTAR namespaces.

Consumers inject both `remote` and the exact namespace service they use, such as `remote.gstarSites`. The Typert carrier owns request envelopes, codecs, publication, and disposal; this package only selects the GSTAR contribution for the product Profile.

## Model Experience

None, as the assembly selects browser Remote namespaces and registers no prompt, tool, Session event, or other model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Only the station namespace is selected. Region, source configuration, processor, and pipeline namespaces join here when their Host Service Definitions exist.
- The package forwards no Host events; current station-list freshness continues through DSH's existing Workspace projection.
