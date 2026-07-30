/**
 * Make Node's global `fetch` honour the standard proxy environment variables.
 *
 * Node's `fetch` is undici, and undici does NOT read `HTTP_PROXY` /
 * `HTTPS_PROXY` / `NO_PROXY` on its own — unlike `curl`, `git` and `pnpm`,
 * which all do. Behind a corporate proxy that makes every outbound call from
 * this process fail at the TCP level while the same request succeeds from the
 * shell, which reads as "the API is down" rather than "the proxy was not used".
 *
 * The `NODE_USE_ENV_PROXY=1` / `--use-env-proxy` runtime flag is NOT a usable
 * substitute here: it is a no-op on Node 22, which this repo supports
 * (`engines.node: >=22`) — verified by pointing `HTTPS_PROXY` at a closed port
 * on v22.20.0 and observing the request still go direct. Installing a
 * dispatcher works on every supported version, so that is what we do.
 *
 * `EnvHttpProxyAgent` is used rather than a bare `ProxyAgent` because it also
 * implements `NO_PROXY`. That distinction is load-bearing, not cosmetic: a
 * plain `ProxyAgent` would tunnel EVERY request, including loopback traffic to
 * a local SPARQL endpoint (`SPARQL_MODE=remote` against localhost Fuseki),
 * which a corporate proxy will refuse.
 *
 * @see https://undici.nodejs.org/#/docs/api/EnvHttpProxyAgent
 */

import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'

/** Proxy variables undici's `EnvHttpProxyAgent` consumes, in its own order. */
const PROXY_VARS = ['https_proxy', 'HTTPS_PROXY', 'http_proxy', 'HTTP_PROXY'] as const

/** Outcome of {@link configureHttpProxyFromEnv}, for startup logging. */
export interface ProxyConfiguration {
  /** True when a dispatcher was installed (i.e. a proxy variable was set). */
  readonly enabled: boolean
  /** Names of the proxy variables that were present, for diagnostics. */
  readonly sources: readonly string[]
  /** The `NO_PROXY` bypass list verbatim, when one is set. */
  readonly noProxy: string | undefined
}

/**
 * Install a proxy-aware global dispatcher when a proxy is configured.
 *
 * Idempotent in effect and a no-op when no proxy variable is present, so a
 * direct-connection setup pays nothing and is never routed anywhere. Call it
 * ONCE, before the first outbound request — a dispatcher installed later does
 * not retroactively apply to in-flight calls.
 *
 * Reads the environment directly rather than `getConfig()` because
 * `EnvHttpProxyAgent` itself reads `process.env` — routing the DECISION through
 * validated config while the AGENT reads the raw environment would let the two
 * disagree, and would silently drop the lowercase spellings (`https_proxy` etc.)
 * that undici honours. The keys are still declared in the Zod schema for
 * documentation, the same arrangement the logger uses for `LOG_LEVEL`.
 *
 * Values are never returned or logged — proxy URLs routinely embed credentials.
 */
export function configureHttpProxyFromEnv(
  // eslint-disable-next-line no-restricted-syntax
  env: NodeJS.ProcessEnv = process.env
): ProxyConfiguration {
  const sources = PROXY_VARS.filter((name) => {
    const value = env[name]
    return typeof value === 'string' && value.trim() !== ''
  })

  const noProxy = env['no_proxy']?.trim() || env['NO_PROXY']?.trim() || undefined

  if (sources.length === 0) return { enabled: false, sources: [], noProxy }

  // EnvHttpProxyAgent re-reads the variables itself, including NO_PROXY.
  setGlobalDispatcher(new EnvHttpProxyAgent())

  return { enabled: true, sources, noProxy }
}
