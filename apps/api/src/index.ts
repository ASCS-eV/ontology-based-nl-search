import type { ServerType } from '@hono/node-server'
import { serve } from '@hono/node-server'
import { getConfig } from '@ontology-search/core/config'
import { createComponentLogger } from '@ontology-search/core/logging'
import { closeSparqlStore } from '@ontology-search/sparql'

import { app } from './app.js'
import { createListenErrorHandler, createShutdownHandler } from './lifecycle.js'
import { setReadiness } from './readiness.js'
import { warmup } from './warmup.js'

const log = createComponentLogger('api')
const port = getConfig().API_PORT

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
    log.info('Ontology Search API ready', { url: `http://localhost:${port}` })
  } else {
    log.warn('Ontology Search API started DEGRADED', {
      url: `http://localhost:${port}`,
      warmupErrorCount: warmupResult.errors.length,
    })
  }
})

// Without this, a listen failure (e.g. EADDRINUSE when another instance holds
// the port) crashes with an unhandled 'error' event and a raw stack trace.
server.on('error', createListenErrorHandler({ port, log, exit: (code) => process.exit(code) }))
