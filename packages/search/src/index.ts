export {
  compileAllCountQueries,
  compileCountQuery,
  compileSlots,
  escapeSparqlLiteral,
  getAssetDomains,
  warmupCompiler,
} from './compiler.js'
export type { ConceptExpansionIndex } from './concept-expansion.js'
export {
  buildConceptExpansionIndex,
  expandConceptValue,
  expandFilterConcepts,
  getConceptExpansionIndex,
  resetConceptExpansionIndex,
} from './concept-expansion.js'
export { getInitializedStore } from './init.js'
export type { LeafKind, PathStep, PropertyPath, ReferenceChain } from './property-paths.js'
export { buildPropertyPaths, buildReferenceChains } from './property-paths.js'
export { SCHEMA_GRAPH } from './schema-loader.js'
export type {
  NlSearchOptions,
  RefineOptions,
  RefineResult,
  SearchProgress,
  SearchResult,
} from './service.js'
export type { SearchDependencies } from './service.js'
export { SearchService } from './service.js'
export type { ReferenceFilter, SearchSlots } from './slots.js'
export type { SparqlValidationIssue, SparqlValidationResult } from './sparql-validator.js'
export { validateSparql } from './sparql-validator.js'
export type {
  LlmStructuredResponse,
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
  SearchResponse,
} from './types.js'
export type { EnumProperty, NumericProperty, OntologyVocabulary } from './vocabulary-extractor.js'
export { extractVocabulary, resetVocabulary } from './vocabulary-extractor.js'
