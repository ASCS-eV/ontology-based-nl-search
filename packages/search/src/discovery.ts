/**
 * Discovery seam — the SHACL-graph-driven schema-metadata surface of `search`.
 *
 * These modules read the ontology graph at runtime to derive what the compiler
 * and the LLM prompt need: asset domains, property paths, the concept-expansion
 * (SKOS) index, the loaded schema graph name, and the enum/numeric vocabulary.
 * None of it is hardcoded. Grouped here as a `@ontology-search/search/discovery`
 * subpath export (ADR 0003, step 4) to make the seam explicit and importable on
 * its own. Like the root surface, it exports only what a consumer outside the
 * package would call — the `reset*` cache hooks are test seams and are reached
 * through their own modules.
 *
 * This is an export barrel only — no logic lives here.
 */
export { getAssetDomains } from './asset-domains.js'
export type { ConceptExpansionIndex } from './concept-expansion.js'
export { expandFilterConcepts, getConceptExpansionIndex } from './concept-expansion.js'
export type { LeafKind, PathStep, PropertyPath, ReferenceChain } from './property-paths.js'
export { buildPropertyPaths, buildReferenceChains } from './property-paths.js'
export { SCHEMA_GRAPH } from './schema-loader.js'
export type { EnumProperty, NumericProperty, SchemaVocabulary } from './vocabulary-extractor.js'
export { extractSchemaVocabulary, getInstanceValues } from './vocabulary-extractor.js'
