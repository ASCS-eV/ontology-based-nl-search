/**
 * Production wiring for SearchService.
 *
 * Separated from service.ts to avoid import dependency on @ontology-search/llm
 * in test contexts. The API layer imports this; tests construct SearchService directly.
 */
import type { NlSearchOptions, RefineOptions, RefineResult, SearchResult } from './service.js'
import { SearchService } from './service.js'

let instance: SearchService | null = null

/**
 * Get the singleton SearchService instance with production dependencies.
 * Routes call this; tests construct SearchService directly with mock deps.
 */
export async function getSearchService(): Promise<SearchService> {
  if (instance) return instance

  // Lazy dynamic imports to avoid circular deps at module load time
  const [
    { generateStructuredSearch },
    { compileSlots, compileAllCountQueries },
    { getInitializedStore },
    { enforceSparqlPolicy },
  ] = await Promise.all([
    import('@ontology-search/llm'),
    import('./compiler.js'),
    import('./init.js'),
    import('@ontology-search/sparql/policy'),
  ])

  instance = new SearchService({
    getStore: getInitializedStore,
    interpretQuery: generateStructuredSearch,
    compileSlots,
    compileCountQueries: compileAllCountQueries,
    enforcePolicy: enforceSparqlPolicy,
  })

  return instance
}

/** Reset singleton (for testing only) */
export function resetSearchService(): void {
  instance = null
}

// ─── Convenience Functions (backward-compatible API) ─────────────────────────

/**
 * Full natural-language search pipeline.
 * Delegates to singleton SearchService.
 */
export async function searchNl(options: NlSearchOptions): Promise<SearchResult> {
  const service = await getSearchService()
  return service.searchNl(options)
}

/**
 * Refine search pipeline (no LLM).
 * Delegates to singleton SearchService.
 */
export async function searchRefine(options: RefineOptions): Promise<RefineResult> {
  const service = await getSearchService()
  return service.searchRefine(options)
}
