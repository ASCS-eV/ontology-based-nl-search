import { getConfig } from '@ontology-search/core/config'
import { getSparqlStore } from '@ontology-search/sparql'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { loadSampleData } from './data-loader.js'
import { loadSchemaGraph } from './schema-loader.js'

/**
 * Shared store initialization — singleton promise.
 * Loads ontology schema (into named graph) and instance data at startup.
 * Guarantees loading happens exactly once, even under concurrent requests.
 */
let initPromise: Promise<SparqlStore> | null = null

export function getInitializedStore(): Promise<SparqlStore> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    const store = getSparqlStore()
    const config = getConfig()

    // Load ontology schema (OWL + SHACL) into named graph
    await loadSchemaGraph(store)

    // Load instance data (default graph)
    if (config.SPARQL_MODE !== 'remote') {
      await loadSampleData(store)
    }

    return store
  })()

  return initPromise
}
