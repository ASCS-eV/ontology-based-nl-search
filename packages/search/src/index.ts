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
export type { ContextTerm } from './schema-index/context-reader.js'
export {
  parseContextTerms,
  readContextTerms,
  readContextTermsForDomain,
  resetContextTerms,
} from './schema-index/context-reader.js'
export type { DomainCard, TermCard, TermConstraints, TermIndex } from './schema-index/term-index.js'
export { buildTermIndex, resetTermIndex } from './schema-index/term-index.js'
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
export { normalizeReferences } from './slots.js'
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
export type {
  EnumProperty,
  NumericProperty,
  OntologyVocabulary,
  SchemaVocabulary,
} from './vocabulary-extractor.js'
export {
  extractSchemaVocabulary,
  extractVocabulary,
  getInstanceValues,
  resetVocabulary,
} from './vocabulary-extractor.js'
// Slot↔GraphQL codec re-exported for back-compat: it moved to its own package
// `@ontology-search/graphql-ir` (ADR 0003, decomposition step 3). Consumers may
// import from there directly; the root `@ontology-search/search` surface is
// unchanged.
export type {
  GraphQLParseError,
  GraphQLParseResult,
  GraphQLValidationIssue,
  GraphQLValidationResult,
} from '@ontology-search/graphql-ir'
export {
  parseGraphQLToSlots,
  slotsToGraphQL,
  validateGraphQL,
  validateGraphQLCompleteness,
} from '@ontology-search/graphql-ir'

// Re-exports from lower layers so upper layers (llm) can depend on search alone.
export { getPrimaryDomain } from '@ontology-search/ontology/domain-registry'
export type {
  ShaclValidationResult,
  ShaclViolation,
} from '@ontology-search/ontology/shacl-validator'
export { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
export type { SparqlStore } from '@ontology-search/sparql/types'
