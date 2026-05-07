import { CachedSparqlStore } from './cached-store'
import { OxigraphStore } from './oxigraph-store'
import { RemoteSparqlStore } from './remote-store'
import type { SparqlStore } from './types'

let storeInstance: SparqlStore | null = null

/**
 * Get the SPARQL store instance based on environment configuration.
 * Singleton pattern — returns the same instance across calls.
 * Wraps the underlying store with an LRU query cache.
 */
export function getSparqlStore(): SparqlStore {
  if (storeInstance) return storeInstance

  const mode = process.env.SPARQL_MODE || 'memory'

  let inner: SparqlStore
  if (mode === 'remote') {
    const endpoint = process.env.SPARQL_ENDPOINT
    if (!endpoint) {
      throw new Error('SPARQL_ENDPOINT must be set when SPARQL_MODE=remote')
    }
    inner = new RemoteSparqlStore(endpoint)
  } else {
    inner = new OxigraphStore()
  }

  // Wrap with LRU cache (configurable via env)
  const cacheSize = parseInt(process.env.SPARQL_CACHE_SIZE || '256', 10)
  const cacheTtl = parseInt(process.env.SPARQL_CACHE_TTL_MS || '300000', 10)
  storeInstance = new CachedSparqlStore(inner, { maxSize: cacheSize, ttlMs: cacheTtl })

  return storeInstance
}

export type { SparqlStore, SparqlResults, SparqlBinding } from './types'
