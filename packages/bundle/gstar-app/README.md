# @deepseek-ai/dsh-gstar-app

English | [中文](README.zh.md)

Profile overlay composed after `dsh-web-app`. It keeps the Web Host and Client infrastructure while replacing the standard chat root with `dsh-client-ui-gstar`. Standard chat presentation rows are disabled because their slots belong to the replaced shell.

The overlay also mounts `dsh-gstar-site-workspace` and `dsh-gstar-client-remotes`. The Host Provider exposes each durable Workspace as one GSTAR station through `ctx.gstarSites`; the GSTAR-only Client Remote assembly mounts that generated namespace into the standard DSH Remote carrier. The browser does not own a duplicate station database.

## Run from source

From the repository root, run `pnpm install`, `pnpm run build`, then `pnpm dsh gstar`. The application listens on `http://127.0.0.1:3080` by default. `pnpm dsh gstar --dump-config` prints the composed `base` → `web-app` → `gstar-app` tree without starting the Host.

## Model Experience

None, as this package changes the browser composition but registers no model-visible prompt, tool, or event.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Station identity and creation now flow through a Workspace-backed Host Service, generated Typert Remote, GSTAR-only Client assembly, and an injected root-component action.
- Region assets and pipeline data join through dedicated Host domains in subsequent packages.
- Agent conversation is not mounted in the first shell delivery. It returns through a GSTAR-owned slot instead of depending on the standard layout's private slot tree.
