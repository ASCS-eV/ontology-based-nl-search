import type { ServerType } from '@hono/node-server'
import { serve } from '@hono/node-server'
import { closeAuthoringBackend } from '@ontology-search/authoring'
import type { AppConfig } from '@ontology-search/core/config'
import { getConfig } from '@ontology-search/core/config'
import { ConfigError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'
import { configureHttpProxyFromEnv } from '@ontology-search/core/net/proxy'
import { closeSparqlStore } from '@ontology-search/sparql'

import { createListenErrorHandler, createShutdownHandler } from './lifecycle.js'
import { setReadiness } from './readiness.js'
import { warmup } from './warmup.js'

const log = createComponentLogger('api')

/**
 * Read the configuration before anything else imports it.
 *
 * A `ConfigError` here is an operator mistake in `.env.local`, not a crash:
 * reported as the message plus where to fix it, and never as an unhandled
 * exception with a stack trace through Zod. This is also why the Hono app is
 * imported dynamically below — a static import would construct it (and read
 * the config) during module loading, before this handler could run.
 */
function loadConfigOrExit(): AppConfig {
  try {
    return getConfig()
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error
    process.stderr.write(
      [
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `✗ ${error.message}`,
        '',
        '  These come from .env.local in the repo root (plus your shell).',
        '  Every setting, its accepted values and its default are documented in',
        '  .env.example. `pnpm run check:setup` checks the rest of the setup.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
      ].join('\n')
    )
    process.exit(1)
  }
}

const config = loadConfigOrExit()
const port = config.API_PORT

// Install the proxy dispatcher BEFORE anything can make an outbound request
// (warmup reaches the LLM provider, and a remote store reaches SPARQL). Node's
// fetch ignores HTTP(S)_PROXY on its own, so behind a corporate proxy every
// such call fails at the TCP level — surfacing as `Cannot connect to API`
// rather than anything naming the proxy. No-op when no proxy is configured.
const proxy = configureHttpProxyFromEnv()
if (proxy.enabled) {
  log.info('Outbound HTTP proxy enabled from the environment', {
    // Names only, never values — proxy URLs routinely embed credentials.
    sources: proxy.sources,
    noProxy: proxy.noProxy ?? '(unset)',
  })
}

// The bundled web UI sends no API key, so outside production this setting only
// produces a wall of 401s that reads like a broken frontend. Warn rather than
// refuse: an operator may deliberately be testing the gate with curl.
if (config.API_KEY && config.NODE_ENV !== 'production') {
  log.warn(
    'API_KEY is set outside production — every request without the key gets 401, ' +
      'and the bundled web UI does not send one. Unset API_KEY in .env.local for local development.'
  )
}

// Imported now, after the configuration has been validated and reported on.
const { app } = await import('./app.js')

/**
 * The HTTP listener, assigned once `serve()` returns. Held at module
 * scope so the shutdown handler — registered BEFORE warmup, see below —
 * can close it. Null while warmup is still running.
 */
let server: ServerType | null = null

// Register the drain handler BEFORE `await warmup()`: warmup is multi-
// second on a cold cache (it spawns the Oxigraph worker), so a Ctrl+C
// during startup must still terminate the worker and exit cleanly. The
// handler reads `server` lazily, tolerating the pre-`serve()` window.
const shutdown = createShutdownHandler({
  getServer: () => server,
  closeStore: closeSparqlStore,
  closeAuthoring: closeAuthoringBackend,
  log,
  exit: (code) => process.exit(code),
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown(signal))
}

log.info('Ontology Search API starting', { port })

const warmupResult = await warmup()
setReadiness(warmupResult)

// The readiness log lives in the listening callback so it only fires on a
// SUCCESSFUL bind — a port conflict must surface as the error below, not a
// misleading "ready" line followed by a crash.
server = serve({ fetch: app.fetch, port }, () => {
  if (warmupResult.ready) {
    log.info('Ontology Search API ready', {
      url: `http://localhost:${port}`,
      // Present when something non-fatal is unavailable (typically the LLM
      // provider) — "ready" alone would read as "everything works".
      ...(warmupResult.warnings.length > 0 ? { warnings: warmupResult.warnings } : {}),
    })
  } else {
    log.warn('Ontology Search API started DEGRADED', {
      url: `http://localhost:${port}`,
      warmupErrorCount: warmupResult.errors.length,
      // The reasons, not just the count: this is the line an operator reads
      // when the UI says every search comes back empty.
      errors: warmupResult.errors,
    })
  }
})

// Without this, a listen failure (e.g. EADDRINUSE when another instance holds
// the port) crashes with an unhandled 'error' event and a raw stack trace.
server.on('error', createListenErrorHandler({ port, log, exit: (code) => process.exit(code) }))
