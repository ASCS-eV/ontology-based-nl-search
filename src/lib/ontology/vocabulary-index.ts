/**
 * Vocabulary Index — extracts allowed values from SHACL shapes.
 *
 * Scientific basis: W3C SHACL (Shapes Constraint Language) defines
 * `sh:in` as the formal mechanism for enumerating allowed values.
 * This module uses SPARQL to extract those enumerations directly
 * from the ontology, making the ontology the single source of truth.
 *
 * Design: Generic — auto-discovers all *.shacl.ttl files in the
 * ontology artifacts directory. New domains (scenario, sensor, etc.)
 * are picked up automatically without code changes.
 *
 * @see https://www.w3.org/TR/shacl/#InConstraintComponent
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'

/** A property with its allowed values as defined by sh:in in SHACL */
export interface VocabularyProperty {
  /** Full IRI of the property */
  iri: string
  /** Local name extracted from IRI (e.g., "roadTypes") */
  localName: string
  /** Human-readable name from sh:name */
  name: string
  /** Description from sh:description */
  description: string
  /** Enumerated allowed values from sh:in (empty if unconstrained) */
  allowedValues: string[]
  /** XSD datatype (e.g., "string", "integer", "float") */
  datatype: string
  /** Which ontology domain this property belongs to (e.g., "hdmap", "georeference") */
  domain: string
}

/** Complete vocabulary index keyed by local property name */
export interface VocabularyIndex {
  properties: Map<string, VocabularyProperty>
  /** All allowed values across all properties, indexed for fast lookup */
  valueToProperty: Map<string, { property: string; value: string; domain: string }[]>
  /** Which ontology domains were loaded */
  domains: string[]
}

/**
 * Root paths for ontology artifacts.
 * Reads from `ontology-sources.json` config at project root.
 * Each source directory contains domain subdirectories with *.shacl.ttl files.
 */
function getArtifactRoots(): string[] {
  const configPath = join(process.cwd(), 'ontology-sources.json')

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const sources = config.sources || []
      return sources.map((s: { path: string }) => join(process.cwd(), s.path))
    } catch {
      // Fall through to default
    }
  }

  // Fallback: env var or default path
  if (process.env.ONTOLOGY_ARTIFACTS_PATH) {
    return [process.env.ONTOLOGY_ARTIFACTS_PATH]
  }

  return [
    join(
      process.cwd(),
      'submodules',
      'hd-map-asset-example',
      'submodules',
      'sl-5-8-asset-tools',
      'submodules',
      'ontology-management-base',
      'artifacts'
    ),
  ]
}

/** Cached singleton */
let cachedIndex: VocabularyIndex | null = null

/**
 * Auto-discover all *.shacl.ttl files across all configured ontology source directories.
 * Each subdirectory represents a domain (hdmap, georeference, scenario, etc.)
 */
function discoverShaclFiles(): { path: string; domain: string }[] {
  const roots = getArtifactRoots()
  const results: { path: string; domain: string }[] = []

  for (const root of roots) {
    if (!existsSync(root)) continue

    for (const entry of readdirSync(root)) {
      const domainDir = join(root, entry)
      if (!statSync(domainDir).isDirectory()) continue

      for (const file of readdirSync(domainDir)) {
        if (file.endsWith('.shacl.ttl')) {
          results.push({ path: join(domainDir, file), domain: entry })
        }
      }
    }
  }

  return results
}

/**
 * Build the vocabulary index by parsing all SHACL shapes found in artifacts.
 * Uses Oxigraph to load the TTL and SPARQL to extract sh:in values.
 *
 * Generic: automatically picks up new ontology domains when their
 * SHACL files are added to the artifacts directory.
 */
export async function buildVocabularyIndex(): Promise<VocabularyIndex> {
  if (cachedIndex) return cachedIndex

  const oxigraph = await import('oxigraph')
  const store = new oxigraph.Store()

  const shaclFiles = discoverShaclFiles()
  const domains: string[] = []

  for (const { path: shaclPath, domain } of shaclFiles) {
    try {
      const ttl = readFileSync(shaclPath, 'utf-8')
      store.load(ttl, { format: 'text/turtle' })
      if (!domains.includes(domain)) domains.push(domain)
    } catch (err) {
      console.warn(`[vocabulary-index] Failed to load ${basename(shaclPath)}: ${err}`)
    }
  }

  // SPARQL query to extract properties with sh:in enumerated values
  const sparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT ?path ?name ?description ?value WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
      ?propShape sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
    }
    ORDER BY ?path ?value
  `

  const results = store.query(sparql) as Map<string, any>[]
  const properties = new Map<string, VocabularyProperty>()

  for (const row of results) {
    const pathTerm = row.get('path')
    const nameTerm = row.get('name')
    const descTerm = row.get('description')
    const valueTerm = row.get('value')

    if (!pathTerm || !valueTerm) continue

    const iri = pathTerm.value
    const localName = extractLocalName(iri)
    const domain = extractDomain(iri)

    if (!properties.has(localName)) {
      properties.set(localName, {
        iri,
        localName,
        name: nameTerm?.value || localName,
        description: descTerm?.value || '',
        allowedValues: [],
        datatype: 'string',
        domain,
      })
    }

    const prop = properties.get(localName)!
    const value = valueTerm.value
    if (!prop.allowedValues.includes(value)) {
      prop.allowedValues.push(value)
    }
  }

  // Also extract numeric/string properties without sh:in (for quantity slots)
  const numericSparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    SELECT ?path ?name ?description ?datatype WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      ?propShape sh:datatype ?datatype .
      OPTIONAL { ?propShape sh:name ?name }
      OPTIONAL { ?propShape sh:description ?description }
      FILTER(?datatype IN (xsd:integer, xsd:float))
      FILTER NOT EXISTS { ?propShape sh:in ?list }
    }
  `

  const numResults = store.query(numericSparql) as Map<string, any>[]
  for (const row of numResults) {
    const pathTerm = row.get('path')
    const nameTerm = row.get('name')
    const descTerm = row.get('description')
    const datatypeTerm = row.get('datatype')

    if (!pathTerm) continue

    const iri = pathTerm.value
    const localName = extractLocalName(iri)
    const domain = extractDomain(iri)

    if (!properties.has(localName)) {
      properties.set(localName, {
        iri,
        localName,
        name: nameTerm?.value || localName,
        description: descTerm?.value || '',
        allowedValues: [],
        datatype: datatypeTerm ? extractLocalName(datatypeTerm.value) : 'string',
        domain,
      })
    }
  }

  // Build reverse index: value → property mappings
  const valueToProperty = new Map<string, { property: string; value: string; domain: string }[]>()
  for (const [propName, prop] of properties) {
    for (const value of prop.allowedValues) {
      const key = value.toLowerCase()
      const existing = valueToProperty.get(key) || []
      existing.push({ property: propName, value, domain: prop.domain })
      valueToProperty.set(key, existing)
    }
  }

  cachedIndex = { properties, valueToProperty, domains }
  return cachedIndex
}

/** Extract local name from an IRI (after last / or #) */
function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/** Extract domain prefix from IRI (e.g., "hdmap" from ".../hdmap/v6/roadTypes") */
function extractDomain(iri: string): string {
  const parts = iri.split('/')
  // Pattern: .../domain/vN/propertyName
  const versionIdx = parts.findIndex((p) => /^v\d+$/.test(p))
  if (versionIdx > 0) return parts[versionIdx - 1]
  return 'unknown'
}

/** Reset cached index (for testing) */
export function resetVocabularyIndex(): void {
  cachedIndex = null
}
