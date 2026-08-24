# @deepseek-ai/dsh-client-ui-gstar

English | [中文](README.zh.md)

GSTAR browser root shell. It occupies the built-in `root` slot and renders the Host-classified `gstarSites.list` projection, so generic `dsh web` Workspaces do not enter the station surface. Unavailable region, source, gate, and pipeline metrics remain pending instead of manufacturing product data in React.

The registering Client plugin owns a React-free station runtime backed by the GSTAR Remote namespace. It loads `gstarSites.list`, exposes an immutable snapshot store, and refreshes after `gstarSites.create`; React never owns or filters the authoritative station membership.

## Model Experience

None, as the package is a browser presentation plugin and contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Region assets and plugin/pipeline projections are not yet wired; their navigation seats identify the next Host services without presenting mock records.
- The create form accepts an existing Host path. A DSH directory-picker contribution will replace manual path entry in a later UI slice.
