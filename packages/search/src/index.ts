export { getAssetDomains, resetAssetDomains } from './asset-domains.js'
export {
  compileAllCountQueries,
  compileCountQuery,
  compileSlots,
  compileSlotsWithTrace,
  escapeSparqlLiteral,
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
export type {
  AssetMetadata,
  DomainGroupAggregate,
  FacetValue,
  PropertyStats,
} from './metadata-index.js'
export { getAssetMetadata, getDomainMetadataAggregate } from './metadata-index.js'
export type { LeafKind, PathStep, PropertyPath, ReferenceChain } from './property-paths.js'
export { buildPropertyPaths, buildReferenceChains } from './property-paths.js'
export type { DataReferenceEdge, ReferenceIndex } from './reference-index.js'
export { getReferenceIndex, resetReferenceIndex } from './reference-index.js'
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
export type {
  CompileResult,
  ReferenceFilter,
  SearchSlots,
  TraceabilityPlan,
  TraceabilityStep,
} from './slots.js'
export type { SparqlValidationIssue, SparqlValidationResult } from './sparql-validator.js'
export { validateSparql } from './sparql-validator.js'
export type { LineageOptions, TraceabilityEdge, TraceabilityNode } from './traceability.js'
export { DEFAULT_LINEAGE_DEPTH, exploreLineage, MAX_LINEAGE_DEPTH } from './traceability.js'
export type {
  LlmStructuredResponse,
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
  SearchResponse,
} from './types.js'
export type { EnumProperty, NumericProperty, OntologyVocabulary } from './vocabulary-extractor.js'
export { extractVocabulary, resetVocabulary } from './vocabulary-extractor.js'
