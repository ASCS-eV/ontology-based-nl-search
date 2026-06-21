/**
 * Vocabulary Extractor — queries the store for the complete vocabulary.
 *
 * Extracts filterable properties (sh:in enumerations), numeric properties,
 * SKOS concept schemes, RDFS class hierarchies, and per-property distinct
 * instance value distributions. All discovered generically — nothing about
 * any specific domain is encoded in code.
 *
 * @see https://www.w3.org/TR/shacl/#InConstraintComponent
 * @see https://www.w3.org/TR/skos-reference/
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import { isIri } from '@ontology-search/sparql/escape'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { getCompilerVocab } from './compiler.js'
import { SCHEMA_GRAPH } from './schema-loader.js'
import {
  queryInstanceValueDistribution,
  querySkosConcepts,
  querySubClassEdges,
  type SkosConceptInfo,
  type SubClassEdge,
} from './schema-queries.js'

/** A property with enumerated allowed values (from sh:in) */
export interface EnumProperty {
  /** Full IRI of the property (e.g., "http://example.org/ontology/v1/propertyName") */
  iri: string
  /** Local name (e.g., "propertyName") */
  localName: string
  /** Human-readable label from sh:name (e.g., "road types") */
  label: string
  /** Description from sh:description */
  description: string
  /** Enumerated allowed values from sh:in */
  allowedValues: string[]
  /** Ontology domain (the SHACL domain name) */
  domain: string
}

/** A numeric property (xsd:integer or xsd:float) */
export interface NumericProperty {
  iri: string
  localName: string
  label: string
  description: string
  datatype: 'integer' | 'float'
  domain: string
}

/** Complete ontology vocabulary extracted from the schema graph */
export interface OntologyVocabulary {
  /** Properties with sh:in enumerations (filterable) */
  enumProperties: EnumProperty[]
  /** Numeric properties (for range queries) */
  numericProperties: NumericProperty[]
  /** All domains found in the schema */
  domains: string[]
  /**
   * SKOS concepts grouped by scheme — discovered generically from
   * any loaded graph. Empty if no SKOS schemes are loaded.
   */
  conceptSchemes: Map<string, SkosConceptInfo[]>
  /**
   * rdfs:subClassOf edges, used by the compiler to expand class-typed
   * filter values to all subclasses generically.
   */
  classHierarchy: SubClassEdge[]
  /**
   * Map from property IRI to distinct literal values observed in instance
   * data. Powers data-driven gap suggestions for any property — no
   * per-domain code paths.
   */
  instanceValues: Map<string, string[]>
}

/** Cached singleton */
let cachedVocabulary: OntologyVocabulary | null = null

/**
 * Extract the full ontology vocabulary from the store.
 *
 * In parallel:
 *  - sh:in enumerations and numeric properties (from the schema graph),
 *  - SKOS concept schemes (from any loaded graph — generic),
 *  - rdfs:subClassOf edges (for compiler hierarchy expansion),
 *  - distinct instance literal values per property (for gap suggestions).
 *
 * No part of this code knows what any specific property means; every
 * discovery is a SPARQL query over standard RDF/SHACL/SKOS vocabulary.
 */
export async function extractVocabulary(store: SparqlStore): Promise<OntologyVocabulary> {
  if (cachedVocabulary) return cachedVocabulary

  // Attribute every property to its owning domain(s) by SHACL shape membership —
  // the SAME discovered property paths the compiler resolves filters against
  // (`getCompilerVocab` is cached; the compiler builds it once at warmup). A
  // property is owned by the domain whose asset-class shape declares it,
  // regardless of the property's own IRI namespace. The previous
  // property-IRI-prefix heuristic orphaned shared-vocabulary leaves — e.g. a
  // `vcard:`/`dcterms:`/`schema:` property used inside a domain's shape resolved
  // to the empty domain and vanished from the editor, even though the compiler
  // could filter it. Deriving attribution from the compiler's path index
  // guarantees the editor exposes exactly the properties that compile, per
  // domain — no parallel heuristic to drift. A property reachable from several
  // domains is attributed to each (matching the compiler's multi-domain paths).
  const compilerVocab = await getCompilerVocab()
  const domainsByPropertyIri = new Map<string, Set<string>>()
  for (const path of compilerVocab.paths.values()) {
    if (!path.domain) continue
    const set = domainsByPropertyIri.get(path.propertyIri) ?? new Set<string>()
    set.add(path.domain)
    domainsByPropertyIri.set(path.propertyIri, set)
  }

  const [enumProperties, numericProperties, skosConcepts, subClassEdges] = await Promise.all([
    extractEnumProperties(store, domainsByPropertyIri),
    extractNumericProperties(store, domainsByPropertyIri),
    querySkosConcepts(store),
    querySubClassEdges(store),
  ])

  // Searchable domains are exactly those that own at least one discovered
  // property (the empty sentinel can no longer appear: unattributable
  // properties are dropped at extraction, not surfaced with a blank domain).
  const domains = [
    ...new Set([...enumProperties.map((p) => p.domain), ...numericProperties.map((p) => p.domain)]),
  ].filter((d) => d.length > 0)

  // Group SKOS concepts by scheme for O(1) lookup at compile time.
  const conceptSchemes = new Map<string, SkosConceptInfo[]>()
  for (const c of skosConcepts) {
    const existing = conceptSchemes.get(c.scheme) ?? []
    existing.push(c)
    conceptSchemes.set(c.scheme, existing)
  }

  // Eager instance-value distribution for every known property IRI — this
  // is the data source for Phase 4 gap suggestions. Restricted to known
  // properties so the query stays bounded on large stores.
  // Filter to valid IRIs only — SHACL property path sequences (blank nodes)
  // may slip through as Skolemized hex strings that aren't valid in SPARQL.
  const knownPropertyIris = [
    ...enumProperties.map((p) => p.iri),
    ...numericProperties.map((p) => p.iri),
  ].filter(isIri)
  const distributions = await queryInstanceValueDistribution(store, knownPropertyIris)
  const instanceValues = new Map<string, string[]>()
  for (const d of distributions) instanceValues.set(d.property, d.values)

  cachedVocabulary = {
    enumProperties,
    numericProperties,
    domains,
    conceptSchemes,
    classHierarchy: subClassEdges,
    instanceValues,
  }
  return cachedVocabulary
}

/** Reset cached vocabulary (for testing) */
export function resetVocabulary(): void {
  cachedVocabulary = null
}

/**
 * Extract all properties with sh:in enumerations from the schema graph.
 */
async function extractEnumProperties(
  store: SparqlStore,
  domainsByPropertyIri: Map<string, Set<string>>
): Promise<EnumProperty[]> {
  const sparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT ?path ?name ?description ?value
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      FILTER(isIRI(?path))
      ?propShape sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
    }
    ORDER BY ?path ?value
  `

  const results = await store.query(sparql)

  // Accumulate the sh:in values per property IRI first; domain attribution is
  // applied afterwards so a property reachable from several domains expands to
  // one entry per domain (sharing the same allowed-value set).
  interface EnumBase {
    iri: string
    localName: string
    label: string
    description: string
    allowedValues: string[]
  }
  const byIri = new Map<string, EnumBase>()

  for (const row of results.results.bindings) {
    const iri = row['path']?.value
    const value = row['value']?.value
    if (!iri || !value) continue

    const localName = extractLocalName(iri)
    let base = byIri.get(iri)
    if (!base) {
      base = {
        iri,
        localName,
        label: row['name']?.value ?? localName,
        description: row['description']?.value ?? '',
        allowedValues: [],
      }
      byIri.set(iri, base)
    }
    if (!base.allowedValues.includes(value)) base.allowedValues.push(value)
  }

  return [...byIri.values()].flatMap((base) =>
    [...(domainsByPropertyIri.get(base.iri) ?? [])].map((domain) => ({
      ...base,
      allowedValues: [...base.allowedValues],
      domain,
    }))
  )
}

/**
 * Extract all numeric properties (xsd:integer, xsd:float) from the schema graph.
 */
async function extractNumericProperties(
  store: SparqlStore,
  domainsByPropertyIri: Map<string, Set<string>>
): Promise<NumericProperty[]> {
  const sparql = `
    ${sparqlPrefixes('sh', 'xsd')}

    SELECT ?path ?name ?description ?datatype
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      FILTER(isIRI(?path))
      ?propShape sh:datatype ?datatype .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
      FILTER(?datatype IN (xsd:integer, xsd:float))
      FILTER NOT EXISTS { ?propShape sh:in ?list }
    }
  `

  const results = await store.query(sparql)
  const seen = new Set<string>()
  const properties: NumericProperty[] = []

  for (const row of results.results.bindings) {
    const iri = row['path']?.value
    if (!iri || seen.has(iri)) continue
    seen.add(iri)

    const datatypeIri = row['datatype']?.value ?? ''
    const datatype = datatypeIri.includes('integer') ? 'integer' : 'float'
    const localName = extractLocalName(iri)
    const label = row['name']?.value ?? localName
    const description = row['description']?.value ?? ''

    // One entry per owning domain (SHACL shape membership); drop properties no
    // domain can resolve — the compiler could not filter them either.
    for (const domain of domainsByPropertyIri.get(iri) ?? []) {
      properties.push({ iri, localName, label, description, datatype, domain })
    }
  }

  return properties
}
