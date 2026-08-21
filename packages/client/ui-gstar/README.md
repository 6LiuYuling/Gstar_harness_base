# @deepseek-ai/dsh-client-ui-gstar

English | [中文](README.zh.md)

GSTAR browser root shell. It occupies the built-in `root` slot and projects durable DSH Workspaces as station workspaces. Unavailable region, source, gate, and pipeline metrics remain pending instead of manufacturing product data in React.

The registering Client plugin injects a `createSite` action into the pure root component. That action calls `ctx.remote.gstarSites.create`; successful creation remains durable in the Host Workspace registry, while the standard Workspace projection supplies the live station list. React never owns the authoritative station state.

## Model Experience

None, as the package is a browser presentation plugin and contributes no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Region assets and plugin/pipeline projections are not yet wired; their navigation seats identify the next Host services without presenting mock records.
- The create form accepts an existing Host path. A DSH directory-picker contribution will replace manual path entry in a later UI slice.
