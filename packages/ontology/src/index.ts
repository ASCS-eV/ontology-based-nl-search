/**
 * Public entry for `@ontology-search/ontology`.
 *
 * Consumers import the fine-grained subpaths (`./domain-registry`, `./sources`,
 * `./shacl-validator`, `./paths`) directly; this barrel re-exports the primary
 * surface for convenience. The previous OWL-fetching / regex-Turtle "ontology
 * context" pipeline and the second-Oxigraph-store `vocabulary-index` were
 * removed — both were dead (no production callers) and the latter duplicated
 * the schema graph already loaded in the worker store's `<urn:graph:schema>`.
 */
export type { DomainDescriptor, DomainRegistry } from './domain-registry.js'
export { buildDomainRegistry } from './domain-registry.js'
export type { LiftOptions } from './xml-to-rdf.js'
export { childPredicateIri, classIri, liftXmlToRdf } from './xml-to-rdf.js'
