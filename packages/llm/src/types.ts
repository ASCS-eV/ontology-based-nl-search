/**
 * Re-export search pipeline types from their canonical location.
 * These types define the contract between the LLM and search layers.
 */
export type {
  LlmStructuredResponse,
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
  SearchResponse,
} from '@ontology-search/search/types'
