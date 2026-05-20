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

export type { SparqlBinding, SparqlResults, SparqlStore } from './types.js'
