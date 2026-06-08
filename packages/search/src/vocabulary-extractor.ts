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
import { extractDomain, extractLocalName } from '@ontology-search/core/rdf/iri'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

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
  /** Full IRI of the property (e.g., "https://...hdmap/v6/roadTypes") */
  iri: string
  /** Local name (e.g., "roadTypes") */
  localName: string
  /** Human-readable label from sh:name (e.g., "road types") */
  label: string
  /** Description from sh:description */
  description: string
  /** Enumerated allowed values from sh:in */
  allowedValues: string[]
  /** Ontology domain (e.g., "hdmap", "scenario") */
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

  // Attribute every property to its owning domain via the registry's
  // longest-prefix matching — the same mechanism schema-queries uses —
  // rather than a fragile `/vN/` path-segment regex that returned the
  // literal "unknown" for any IRI not matching that convention (gx:,
  // fragment IRIs, …). The registry is a cached singleton, so this is cheap.
  const registry = await buildDomainRegistry()

  const [enumProperties, numericProperties, skosConcepts, subClassEdges] = await Promise.all([
    extractEnumProperties(store, registry),
    extractNumericProperties(store, registry),
    querySkosConcepts(store),
    querySubClassEdges(store),
  ])

  // Drop the empty-string sentinel `extractDomain` returns for an
  // unresolvable IRI — it is not a searchable domain and must never reach
  // the interpretation or the compiler.
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
  const knownPropertyIris = [
    ...enumProperties.map((p) => p.iri),
    ...numericProperties.map((p) => p.iri),
  ]
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
  registry: DomainRegistry
): Promise<EnumProperty[]> {
  const sparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT ?path ?name ?description ?value
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      ?propShape sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
    }
    ORDER BY ?path ?value
  `

  const results = await store.query(sparql)
  const propertyMap = new Map<string, EnumProperty>()

  for (const row of results.results.bindings) {
    const iri = row['path']?.value
    const value = row['value']?.value
    if (!iri || !value) continue

    const localName = extractLocalName(iri)
    const domain = extractDomain(iri, (i) => registry.domainForIri(i))

    if (!propertyMap.has(iri)) {
      propertyMap.set(iri, {
        iri,
        localName,
        label: row['name']?.value ?? localName,
        description: row['description']?.value ?? '',
        allowedValues: [],
        domain,
      })
    }

    const prop = propertyMap.get(iri)!
    if (!prop.allowedValues.includes(value)) {
      prop.allowedValues.push(value)
    }
  }

  return [...propertyMap.values()]
}

/**
 * Extract all numeric properties (xsd:integer, xsd:float) from the schema graph.
 */
async function extractNumericProperties(
  store: SparqlStore,
  registry: DomainRegistry
): Promise<NumericProperty[]> {
  const sparql = `
    ${sparqlPrefixes('sh', 'xsd')}

    SELECT ?path ?name ?description ?datatype
    FROM <${SCHEMA_GRAPH}>
    WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
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

    properties.push({
      iri,
      localName: extractLocalName(iri),
      label: row['name']?.value ?? extractLocalName(iri),
      description: row['description']?.value ?? '',
      datatype,
      domain: extractDomain(iri, (i) => registry.domainForIri(i)),
    })
  }

  return properties
}
