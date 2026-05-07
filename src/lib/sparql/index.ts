import { getConfig } from '@/lib/config'

import { CachedSparqlStore } from './cached-store'
import { OxigraphStore } from './oxigraph-store'
import { RemoteSparqlStore } from './remote-store'
import type { SparqlStore } from './types'

let storeInstance: SparqlStore | null = null

/**
 * Get the SPARQL store instance based on validated application config.
 * Singleton pattern — returns the same instance across calls.
 * Wraps the underlying store with an LRU query cache.
 */
export function getSparqlStore(): SparqlStore {
  if (storeInstance) return storeInstance

  const config = getConfig()

  let inner: SparqlStore
  if (config.SPARQL_MODE === 'remote') {
    // Config validation guarantees SPARQL_ENDPOINT exists when mode is remote
    inner = new RemoteSparqlStore(config.SPARQL_ENDPOINT!)
  } else {
    inner = new OxigraphStore()
  }

  storeInstance = new CachedSparqlStore(inner, {
    maxSize: config.SPARQL_CACHE_SIZE,
    ttlMs: config.SPARQL_CACHE_TTL_MS,
  })

  return storeInstance
}

export type { SparqlStore, SparqlResults, SparqlBinding } from './types'
