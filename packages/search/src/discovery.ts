/**
 * Discovery seam — the SHACL-graph-driven schema-metadata surface of `search`.
 *
 * These modules read the ontology graph at runtime to derive what the compiler
 * and the LLM prompt need: asset domains, property paths, the concept-expansion
 * (SKOS) index, the loaded schema graph name, and the enum/numeric vocabulary.
 * None of it is hardcoded. Grouped here as a `@ontology-search/search/discovery`
 * subpath export (ADR 0003, step 4) to make the seam explicit and importable on
 * its own; the root `.` surface still re-exports everything for back-compat.
 *
 * This is an export barrel only — no logic lives here.
 */
export { getAssetDomains, resetAssetDomains } from './asset-domains.js'
export type { ConceptExpansionIndex } from './concept-expansion.js'
export {
  buildConceptExpansionIndex,
  expandConceptValue,
  expandFilterConcepts,
  getConceptExpansionIndex,
  resetConceptExpansionIndex,
} from './concept-expansion.js'
export type { LeafKind, PathStep, PropertyPath, ReferenceChain } from './property-paths.js'
export { buildPropertyPaths, buildReferenceChains } from './property-paths.js'
export { SCHEMA_GRAPH } from './schema-loader.js'
export type { EnumProperty, NumericProperty, SchemaVocabulary } from './vocabulary-extractor.js'
export {
  extractSchemaVocabulary,
  getInstanceValues,
  resetVocabulary,
} from './vocabulary-extractor.js'
