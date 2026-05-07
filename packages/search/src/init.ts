import { getConfig } from '@ontology-search/core/config'
import { getSparqlStore } from '@ontology-search/sparql'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { loadSampleData } from './data-loader.js'

/**
 * Shared store initialization — singleton promise.
 * Guarantees data is loaded exactly once, even under concurrent requests.
 */
let initPromise: Promise<SparqlStore> | null = null

export function getInitializedStore(): Promise<SparqlStore> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    const store = getSparqlStore()
    const config = getConfig()

    if (config.SPARQL_MODE !== 'remote') {
      await loadSampleData(store)
    }

    return store
  })()

  return initPromise
}
