/**
 * SKOS Concept Loader — discovers and parses TTL files, builds concept index.
 *
 * Responsibilities:
 * - Locate SKOS annotation files from ontology-sources.json
 * - Parse TTL using Oxigraph's in-memory store
 * - Extract concepts with prefLabel, altLabels, relationships
 * - Build label → concept URI reverse index
 *
 * @see https://www.w3.org/TR/skos-reference/
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/** Oxigraph RDF term (subset of RDF/JS Term) */
interface RdfTerm {
  value: string
}

/** Row from an Oxigraph SELECT query */
type OxigraphRow = Map<string, RdfTerm>

/** SKOS concept as extracted from the TTL */
export interface SkosConcept {
  uri: string
  prefLabel: string
  altLabels: string[]
  ontologyProperty: string
  /** Domain this concept belongs to (extracted from property IRI) */
  domain: string
  ontologyValue: string
  broader: string[]
  narrower: string[]
  related: string[]
}

/** Result of loading and indexing SKOS concepts */
export interface SkosIndex {
  /** Concept URI → SkosConcept map */
  concepts: Map<string, SkosConcept>
  /** Lowercased label → concept URI reverse index */
  labelIndex: Map<string, string>
}

/** Cached SKOS index */
let cachedIndex: SkosIndex | null = null

/**
 * Get SKOS annotation file paths from ontology-sources.json config.
 * Supports both individual files and directories (scans for *.ttl).
 */
function getSkosFilePaths(): string[] {
  const configPath = join(process.cwd(), 'ontology-sources.json')

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const skos = config.skos || []
      const paths: string[] = []

      for (const entry of skos) {
        const fullPath = join(process.cwd(), entry.path)
        if (entry.directory) {
          if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
            for (const file of readdirSync(fullPath)) {
              if (file.endsWith('.ttl')) {
                paths.push(join(fullPath, file))
              }
            }
          }
        } else {
          paths.push(fullPath)
        }
      }

      return paths
    } catch {
      // Fall through to default
    }
  }

  return [join(process.cwd(), 'src', 'lib', 'ontology', 'skos-annotations.ttl')]
}

/** Extract local name from IRI (after last # or /) */
function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/** Extract domain name from ENVITED-X property IRI */
function extractDomainFromIri(iri: string): string {
  const match = iri.match(/\/envited-x\/([^/]+)\/v\d+\//)
  return match?.[1] || 'unknown'
}

/**
 * Load and index the SKOS concept scheme.
 * Uses Oxigraph to parse TTL and SPARQL to extract concepts.
 * Result is cached — subsequent calls return the same index.
 */
export async function loadSkosIndex(): Promise<SkosIndex> {
  if (cachedIndex) return cachedIndex

  const oxigraph = await import('oxigraph')
  const store = new oxigraph.Store()

  const skosPaths = getSkosFilePaths()
  for (const skosPath of skosPaths) {
    try {
      const ttl = readFileSync(skosPath, 'utf-8')
      store.load(ttl, { format: 'text/turtle' })
    } catch {
      // Skip missing SKOS files gracefully
    }
  }

  // Extract all concepts with their labels and properties
  const conceptSparql = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX nlsearch: <https://w3id.org/ascs-ev/ontology-based-nl-search/concepts/>

    SELECT ?concept ?prefLabel ?ontologyProperty ?ontologyValue WHERE {
      ?concept a skos:Concept ;
        skos:prefLabel ?prefLabel ;
        nlsearch:ontologyProperty ?ontologyProperty ;
        nlsearch:ontologyValue ?ontologyValue .
    }
  `

  const concepts = store.query(conceptSparql) as OxigraphRow[]
  const conceptMap = new Map<string, SkosConcept>()

  for (const row of concepts) {
    const uri = row.get('concept')?.value
    if (!uri || conceptMap.has(uri)) continue

    conceptMap.set(uri, {
      uri,
      prefLabel: row.get('prefLabel')?.value || '',
      altLabels: [],
      ontologyProperty: extractLocalName(row.get('ontologyProperty')?.value || ''),
      domain: extractDomainFromIri(row.get('ontologyProperty')?.value || ''),
      ontologyValue: row.get('ontologyValue')?.value || '',
      broader: [],
      narrower: [],
      related: [],
    })
  }

  // Extract altLabels
  const altLabelSparql = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?concept ?altLabel WHERE {
      ?concept a skos:Concept ;
        skos:altLabel ?altLabel .
    }
  `
  const altResults = store.query(altLabelSparql) as OxigraphRow[]
  for (const row of altResults) {
    const uri = row.get('concept')?.value
    const label = row.get('altLabel')?.value
    if (uri && label && conceptMap.has(uri)) {
      conceptMap.get(uri)!.altLabels.push(label)
    }
  }

  // Extract broader/narrower/related relationships
  const relSparql = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?concept ?rel ?target WHERE {
      ?concept a skos:Concept .
      VALUES ?relType { skos:broader skos:narrower skos:related }
      ?concept ?relType ?target .
      BIND(REPLACE(STR(?relType), ".*#", "") AS ?rel)
    }
  `
  const relResults = store.query(relSparql) as OxigraphRow[]
  for (const row of relResults) {
    const uri = row.get('concept')?.value
    const rel = row.get('rel')?.value
    const target = row.get('target')?.value
    if (uri && rel && target && conceptMap.has(uri)) {
      const concept = conceptMap.get(uri)!
      if (rel === 'broader') concept.broader.push(target)
      else if (rel === 'narrower') concept.narrower.push(target)
      else if (rel === 'related') concept.related.push(target)
    }
  }

  // Build label → URI reverse index
  const labelIdx = new Map<string, string>()
  for (const [uri, concept] of conceptMap) {
    const addWithVariants = (label: string) => {
      const lower = label.toLowerCase()
      labelIdx.set(lower, uri)
      // Add space-separated variant of hyphenated terms
      if (lower.includes('-')) {
        labelIdx.set(lower.replace(/-/g, ' '), uri)
      }
    }

    addWithVariants(concept.prefLabel)
    addWithVariants(concept.ontologyValue)
    for (const alt of concept.altLabels) {
      addWithVariants(alt)
    }
  }

  cachedIndex = { concepts: conceptMap, labelIndex: labelIdx }
  return cachedIndex
}

/** Reset cached index (for testing) */
export function resetSkosIndex(): void {
  cachedIndex = null
}
