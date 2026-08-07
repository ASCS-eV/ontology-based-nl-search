export { getAssetDomains, resetAssetDomains } from './asset-domains.js'
export {
  compileAllCountQueries,
  compileCountQuery,
  compileSlots,
  compileSlotsWithTrace,
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
export { preferDomainsNamedInQuery } from './domain-preference.js'
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
export type { EmbeddingProvider } from './schema-index/embedding.js'
export { lexicalOnlyProvider } from './schema-index/embedding.js'
export type { FragmentSelection, ShaclFragment } from './schema-index/fragment-extractor.js'
export { extractShaclFragments, renderDistilledCards } from './schema-index/fragment-extractor.js'
export type { RankOptions, ScoredCard, ScoredDomain } from './schema-index/ranking.js'
export { lexicalScore, rankCards, rankDomains, tokenize } from './schema-index/ranking.js'
export type { RetrievalOptions, RetrievedSchema } from './schema-index/retrieval.js'
export { retrieveRelevantSchema, warmupRetrievalIndex } from './schema-index/retrieval.js'
export type { DomainCard, TermCard, TermConstraints, TermIndex } from './schema-index/term-index.js'
export { buildTermIndex, resetTermIndex } from './schema-index/term-index.js'
export { toVocabularyResponse } from './schema-index/to-vocabulary-response.js'
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
export type { SparqlValidationIssue, SparqlValidationResult } from './sparql-validator.js'
export { validateSparql } from './sparql-validator.js'
export type { LineageOptions, TraceabilityEdge, TraceabilityNode } from './traceability.js'
export { DEFAULT_LINEAGE_DEPTH, exploreLineage, MAX_LINEAGE_DEPTH } from './traceability.js'
export type { LlmStructuredResponse } from './types.js'
export type { EnumProperty, NumericProperty, SchemaVocabulary } from './vocabulary-extractor.js'
export {
  extractSchemaVocabulary,
  getInstanceValues,
  resetVocabulary,
} from './vocabulary-extractor.js'

// This barrel exports what THIS package owns and nothing else. The slot IR
// (`@ontology-search/slots`), the slot↔GraphQL codec
// (`@ontology-search/graphql-ir`), the SHACL validator and domain registry
// (`@ontology-search/ontology`) and the store interface
// (`@ontology-search/sparql`) are each their own package; consumers import
// them directly and declare the dependency. Re-exporting them here made
// `llm -> ontology` and `llm -> slots` invisible to `scripts/check-layers.mjs`,
// which reads the DECLARED package.json graph — the gate now rejects a
// downward re-export from any entry point.
