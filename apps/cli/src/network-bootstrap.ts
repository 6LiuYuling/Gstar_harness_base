/** Process-level network bootstrap shared by source and installed CLI entrypoints. */

import * as http from 'node:http'

/** Node versions with dynamic proxy support expose this function from `node:http`. */
interface ProxyCapableHttp {
  setGlobalProxyFromEnv?: (environment?: NodeJS.ProcessEnv) => unknown
}

/** True when an inherited HTTP proxy can affect Host HTTP(S) requests. */
function hasHttpProxy(environment: NodeJS.ProcessEnv): boolean {
  return ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
    .some(name => (environment[name]?.trim().length ?? 0) > 0)
}

/**
 * Apply inherited HTTP(S) proxy variables to Node's global fetch dispatcher.
 *
 * DSH accepts proxy variables only from the launching environment. Node does not
 * consume them for `fetch()` unless it was started with `--use-env-proxy` (or the
 * equivalent environment switch), so the CLI activates the same built-in support
 * before any Profile plugins can make network requests.
 *
 * @returns true when Node's dynamic proxy bootstrap was applied.
 */
export function enableInheritedHttpProxy(
  environment: NodeJS.ProcessEnv = process.env,
  runtime: ProxyCapableHttp = http as unknown as ProxyCapableHttp,
  warn: (line: string) => void = line => void process.stderr.write(line),
): boolean {
  if (!hasHttpProxy(environment)) return false
  if (runtime.setGlobalProxyFromEnv === undefined) {
    warn(
      `dsh: inherited HTTP(S)_PROXY is present, but Node ${process.versions.node}`
      + ' cannot apply it dynamically; start Node with NODE_USE_ENV_PROXY=1\n',
    )
    return false
  }
  runtime.setGlobalProxyFromEnv(environment)
  return true
}
