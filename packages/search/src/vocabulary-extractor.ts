/**
 * Vocabulary Extractor — queries the ontology schema graph for the complete vocabulary.
 *
 * Extracts all filterable properties (sh:in enumerations), numeric properties,
 * and their metadata (labels, descriptions) directly from the SHACL shapes
 * loaded into the schema named graph.
 *
 * This replaces both vocabulary-index.ts and the manual SKOS annotations.
 * The ontology IS the vocabulary — no manual synonym files needed.
 *
 * @see https://www.w3.org/TR/shacl/#InConstraintComponent
 */
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

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
}

/** Cached singleton */
let cachedVocabulary: OntologyVocabulary | null = null

/**
 * Extract the full ontology vocabulary from the schema graph.
 * Queries SHACL shapes for sh:in enumerations and numeric properties.
 */
export async function extractVocabulary(store: SparqlStore): Promise<OntologyVocabulary> {
  if (cachedVocabulary) return cachedVocabulary

  const [enumProperties, numericProperties] = await Promise.all([
    extractEnumProperties(store),
    extractNumericProperties(store),
  ])

  const domains = [
    ...new Set([...enumProperties.map((p) => p.domain), ...numericProperties.map((p) => p.domain)]),
  ]

  cachedVocabulary = { enumProperties, numericProperties, domains }
  return cachedVocabulary
}

/** Reset cached vocabulary (for testing) */
export function resetVocabulary(): void {
  cachedVocabulary = null
}

/**
 * Extract all properties with sh:in enumerations from the schema graph.
 */
async function extractEnumProperties(store: SparqlStore): Promise<EnumProperty[]> {
  const sparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

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
    const domain = extractDomain(iri)

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
async function extractNumericProperties(store: SparqlStore): Promise<NumericProperty[]> {
  const sparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

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
      domain: extractDomain(iri),
    })
  }

  return properties
}

/** Extract local name from an IRI (after last / or #) */
function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/** Extract domain from IRI (e.g., "hdmap" from ".../hdmap/v6/roadTypes") */
function extractDomain(iri: string): string {
  const parts = iri.split('/')
  const versionIdx = parts.findIndex((p) => /^v\d+$/.test(p))
  if (versionIdx > 0) return parts[versionIdx - 1] ?? 'unknown'
  return 'unknown'
}
