# @deepseek-ai/dsh-gstar-app

English | [中文](README.zh.md)

Profile overlay composed after `dsh-web-app`. It keeps the Web Host and Client infrastructure while replacing the standard chat root with `dsh-client-ui-gstar`. Standard chat presentation rows are disabled because their slots belong to the replaced shell.

The overlay also mounts `dsh-gstar-site-workspace`. That Host Provider exposes each durable Workspace as one GSTAR station through `ctx.gstarSites` and its Typert Remote contract; the browser does not own a duplicate station database.

## Run from source

From the repository root, run `pnpm install`, `pnpm run build`, then `pnpm dsh gstar`. The application listens on `http://127.0.0.1:3080` by default. `pnpm dsh gstar --dump-config` prints the composed `base` → `web-app` → `gstar-app` tree without starting the Host.

## Model Experience

None directly. This package changes the browser surface but registers no model-visible prompt, tool, or event.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Station identity and creation now have a Workspace-backed Host Service and Remote contract. The current shell still reads the shared Workspace projection until the GSTAR Client Remote assembly is mounted.
- Region assets and pipeline data join through dedicated Host domains in subsequent packages.
- Agent conversation is not mounted in the first shell delivery. It returns through a GSTAR-owned slot instead of depending on the standard layout's private slot tree.
