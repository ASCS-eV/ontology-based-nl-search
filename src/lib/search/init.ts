import { getConfig } from '@/lib/config'
import { loadSampleData } from '@/lib/data/loader'
import type { SparqlStore } from '@/lib/sparql'
import { getSparqlStore } from '@/lib/sparql'

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
