/**
 * Production wiring for SearchService (composition root).
 *
 * This is the API app's responsibility: wiring @ontology-search/llm into
 * @ontology-search/search. The search package defines the interfaces;
 * this module provides the concrete implementations.
 *
 * Tests construct SearchService directly with mock dependencies.
 */
import { generateStructuredSearch } from '@ontology-search/llm'
import type {
  NlSearchOptions,
  RefineOptions,
  RefineResult,
  SearchResult,
} from '@ontology-search/search'
import {
  compileAllCountQueries,
  compileSlots,
  getInitializedStore,
  type SearchDependencies,
  SearchService,
} from '@ontology-search/search'
import { enforceSparqlPolicy } from '@ontology-search/sparql/policy'

let instance: SearchService | null = null

/**
 * Get the singleton SearchService instance with production dependencies.
 */
export async function getSearchService(): Promise<SearchService> {
  if (instance) return instance

  const deps: SearchDependencies = {
    getStore: getInitializedStore,
    interpretQuery: generateStructuredSearch,
    compileSlots,
    compileCountQueries: compileAllCountQueries,
    enforcePolicy: enforceSparqlPolicy,
  }

  instance = new SearchService(deps)
  return instance
}

/** Reset singleton (for testing only) */
export function resetSearchService(): void {
  instance = null
}

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
