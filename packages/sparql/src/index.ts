import { getConfig } from '@ontology-search/core/config'

import { CachedSparqlStore } from './cached-store.js'
import { RemoteSparqlStore } from './remote-store.js'
import type { SparqlStore } from './types.js'
import { WorkerOxigraphStore } from './worker-oxigraph-store.js'

let storeInstance: SparqlStore | null = null

/**
 * Get the SPARQL store instance based on validated application config.
 * Singleton pattern — returns the same instance across calls.
 * Wraps the underlying store with an LRU query cache.
 *
 * For in-memory mode, uses WorkerOxigraphStore which runs Oxigraph WASM
 * in a dedicated worker thread — synchronous WASM query execution no
 * longer blocks the main event loop.
 *
 * Note: No race condition in Node.js — JS is single-threaded and this
 * function is synchronous. The if-check and assignment cannot interleave.
 */
export function getSparqlStore(): SparqlStore {
  if (storeInstance) return storeInstance

  const config = getConfig()

  let inner: SparqlStore
  if (config.SPARQL_MODE === 'remote') {
    const endpoint = config.SPARQL_ENDPOINT
    if (!endpoint) {
      throw new Error('SPARQL_ENDPOINT is required when SPARQL_MODE is "remote"')
    }
    inner = new RemoteSparqlStore(endpoint)
  } else {
    inner = new WorkerOxigraphStore()
  }

  storeInstance = new CachedSparqlStore(inner, {
    maxSize: config.SPARQL_CACHE_SIZE,
    ttlMs: config.SPARQL_CACHE_TTL_MS,
  })

  return storeInstance
}

/**
 * Release the singleton store's resources and clear the instance so a
 * subsequent `getSparqlStore()` builds a fresh one. Call this from the
 * host process's graceful-shutdown handler (SIGINT/SIGTERM) — the
 * in-memory worker store holds a ref'd worker thread that otherwise
 * keeps the Node event loop alive and blocks a clean exit.
 *
 * Idempotent: a no-op when no store has been created yet.
 */
export async function closeSparqlStore(): Promise<void> {
  if (!storeInstance) return
  const store = storeInstance
  storeInstance = null
  await store.close?.()
}

export { probePropertyPathSupport } from './capability-probe.js'
export type { SparqlBinding, SparqlResults, SparqlStore } from './types.js'
