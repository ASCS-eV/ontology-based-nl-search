import type { SparqlStore } from './types'
import { OxigraphStore } from './oxigraph-store'
import { RemoteSparqlStore } from './remote-store'

let storeInstance: SparqlStore | null = null

/**
 * Get the SPARQL store instance based on environment configuration.
 * Singleton pattern — returns the same instance across calls.
 */
export function getSparqlStore(): SparqlStore {
  if (storeInstance) return storeInstance

  const mode = process.env.SPARQL_MODE || 'memory'

  if (mode === 'remote') {
    const endpoint = process.env.SPARQL_ENDPOINT
    if (!endpoint) {
      throw new Error('SPARQL_ENDPOINT must be set when SPARQL_MODE=remote')
    }
    storeInstance = new RemoteSparqlStore(endpoint)
  } else {
    storeInstance = new OxigraphStore()
  }

  return storeInstance
}

export type { SparqlStore, SparqlResults, SparqlBinding } from './types'
