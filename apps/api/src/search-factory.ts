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
import { validateSlotsAgainstShacl } from '@ontology-search/llm'
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
import type {
  NlSearchOptions,
  RefineOptions,
  RefineResult,
  SearchResult,
  SearchSlots,
} from '@ontology-search/search'
import {
  compileAllCountQueries,
  compileSlots,
  extractVocabulary,
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
    validateSlots: async (slots: SearchSlots): Promise<SearchSlots> => {
      // Defense-in-depth gate for /refine: run the same SHACL validator the
      // LLM agent uses, then re-emit the slots with any violating values
      // dropped. The compiler will see only ontology-valid filters/location.
      const shacl = await ShaclValidator.fromWorkspace()
      const store = await getInitializedStore()
      const vocabulary = await extractVocabulary(store)
      const result = await validateSlotsAgainstShacl(
        slots.filters ?? {},
        slots.location,
        slots.license,
        shacl,
        vocabulary
      )
      return {
        ...slots,
        filters: result.filters,
        location: result.location,
        license: result.license,
      }
    },
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
