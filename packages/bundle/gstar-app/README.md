# @deepseek-ai/dsh-gstar-app

English | [中文](README.zh.md)

Profile overlay composed after `dsh-web-app`. It keeps the Web Host and Client infrastructure while replacing the standard chat root with `dsh-client-ui-gstar`. Standard chat presentation rows are disabled because their slots belong to the replaced shell.

## Run from source

From the repository root, run `pnpm install`, `pnpm run build`, then `pnpm dsh gstar`. The application listens on `http://127.0.0.1:3080` by default. `pnpm dsh gstar --dump-config` prints the composed `base` → `web-app` → `gstar-app` tree without starting the Host.

## Model Experience

None directly. This package changes the browser surface but registers no model-visible prompt, tool, or event.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The first delivery contains the GSTAR workspace shell and reads the existing Workspace projection; region assets and pipeline data join through dedicated Host domains in subsequent packages.
- Agent conversation is not mounted in the first shell delivery. It returns through a GSTAR-owned slot instead of depending on the standard layout's private slot tree.
