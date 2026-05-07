/**
 * Domain Glossary — provides rich explanations for domain terms.
 *
 * Uses SKOS annotations (skos:definition, skos:scopeNote) from the
 * concept scheme to explain terms to users. Distinguishes between:
 *
 * 1. Filterable concepts — terms that map to ontology properties
 * 2. Domain-only concepts — common domain terms that are NOT directly
 *    filterable but have explanations and suggested alternatives
 *
 * Scientific basis: W3C SKOS defines skos:definition for formal
 * definitions and skos:scopeNote for usage guidance within a
 * particular context.
 *
 * @see https://www.w3.org/TR/skos-reference/#notes
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { getProjectRoot } from './paths.js'

export interface GlossaryEntry {
  /** The canonical label */
  term: string
  /** Formal definition */
  definition: string
  /** Contextual usage note (how to use in this search system) */
  scopeNote?: string
  /** Whether this maps to a filterable ontology property */
  filterable: boolean
  /** If filterable, which property */
  property?: string
  /** If filterable, which value */
  value?: string
  /** Related concept labels (for suggesting alternatives) */
  relatedTerms: string[]
  /** All known synonyms/alternative labels */
  synonyms: string[]
}

/** Cached glossary entries keyed by normalized label */
let glossaryCache: Map<string, GlossaryEntry> | null = null

/**
 * Load glossary from the SKOS concept scheme.
 * Extracts definitions, scope notes, and relationships.
 */
async function loadGlossary(): Promise<Map<string, GlossaryEntry>> {
  if (glossaryCache) return glossaryCache

  const oxigraph = await import('oxigraph')
  const store = new oxigraph.Store()

  const skosPaths = getSkosFilePaths()
  for (const skosPath of skosPaths) {
    try {
      const ttl = readFileSync(skosPath, 'utf-8')
      store.load(ttl, { format: 'text/turtle' })
    } catch {
      // Skip missing files
    }
  }

  const entries = new Map<string, GlossaryEntry>()

  // Query all concepts with definitions
  const sparql = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX nlsearch: <https://w3id.org/ascs-ev/ontology-based-nl-search/concepts/>

    SELECT ?concept ?prefLabel ?definition ?scopeNote ?domainOnly ?ontologyProperty ?ontologyValue WHERE {
      ?concept a skos:Concept ;
        skos:prefLabel ?prefLabel .
      OPTIONAL { ?concept skos:definition ?definition }
      OPTIONAL { ?concept skos:scopeNote ?scopeNote }
      OPTIONAL { ?concept nlsearch:domainOnly ?domainOnly }
      OPTIONAL { ?concept nlsearch:ontologyProperty ?ontologyProperty }
      OPTIONAL { ?concept nlsearch:ontologyValue ?ontologyValue }
    }
  `

  type SparqlRow = Map<string, { value: string }>
  const results = store.query(sparql) as SparqlRow[]

  // First pass: build entries
  const uriToEntry = new Map<string, GlossaryEntry>()

  for (const row of results) {
    const uri = row.get('concept')?.value
    const prefLabel = row.get('prefLabel')?.value
    if (!uri || !prefLabel) continue
    if (uriToEntry.has(uri)) continue

    const isDomainOnly = row.get('domainOnly')?.value === 'true'
    const ontologyProperty = row.get('ontologyProperty')?.value
    const ontologyValue = row.get('ontologyValue')?.value

    const entry: GlossaryEntry = {
      term: prefLabel,
      definition: row.get('definition')?.value || '',
      scopeNote: row.get('scopeNote')?.value,
      filterable: !isDomainOnly && !!ontologyProperty,
      property: ontologyProperty ? extractLocalName(ontologyProperty) : undefined,
      value: ontologyValue,
      relatedTerms: [],
      synonyms: [],
    }

    uriToEntry.set(uri, entry)
  }

  // Extract altLabels
  const altSparql = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?concept ?altLabel WHERE {
      ?concept a skos:Concept ;
        skos:altLabel ?altLabel .
    }
  `
  const altResults = store.query(altSparql) as SparqlRow[]
  for (const row of altResults) {
    const uri = row.get('concept')?.value
    const altLabel = row.get('altLabel')?.value
    if (uri && altLabel) {
      const entry = uriToEntry.get(uri)
      if (entry) entry.synonyms.push(altLabel)
    }
  }

  // Extract related concept labels
  const relSparql = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?concept ?related ?relatedLabel WHERE {
      ?concept a skos:Concept ;
        skos:related ?related .
      ?related skos:prefLabel ?relatedLabel .
    }
  `
  const relResults = store.query(relSparql) as SparqlRow[]
  for (const row of relResults) {
    const uri = row.get('concept')?.value
    const relatedLabel = row.get('relatedLabel')?.value
    if (uri && relatedLabel) {
      const entry = uriToEntry.get(uri)
      if (entry) entry.relatedTerms.push(relatedLabel)
    }
  }

  // Build lookup index (prefLabel + altLabels → entry)
  for (const entry of uriToEntry.values()) {
    const key = entry.term.toLowerCase()
    entries.set(key, entry)
    for (const syn of entry.synonyms) {
      entries.set(syn.toLowerCase(), entry)
    }
  }

  glossaryCache = entries
  return entries
}

/**
 * Look up a term in the domain glossary.
 * Returns the glossary entry if found, or null.
 */
export async function lookupGlossary(term: string): Promise<GlossaryEntry | null> {
  const glossary = await loadGlossary()
  return glossary.get(term.toLowerCase()) ?? null
}

/**
 * Look up multiple terms and return entries for those found.
 */
export async function lookupGlossaryBatch(terms: string[]): Promise<Map<string, GlossaryEntry>> {
  const glossary = await loadGlossary()
  const results = new Map<string, GlossaryEntry>()

  for (const term of terms) {
    const entry = glossary.get(term.toLowerCase())
    if (entry) {
      results.set(term, entry)
    }
  }

  return results
}

/**
 * Get all domain-only (non-filterable) glossary entries.
 * Useful for showing users what concepts exist but can't be directly searched.
 */
export async function getDomainOnlyConcepts(): Promise<GlossaryEntry[]> {
  const glossary = await loadGlossary()
  const seen = new Set<string>()
  const domainOnly: GlossaryEntry[] = []

  for (const entry of glossary.values()) {
    if (!entry.filterable && entry.definition && !seen.has(entry.term)) {
      seen.add(entry.term)
      domainOnly.push(entry)
    }
  }

  return domainOnly
}

/** Extract local name from a URI (after last # or /) */
function extractLocalName(uri: string): string {
  const hashIdx = uri.lastIndexOf('#')
  if (hashIdx !== -1) return uri.slice(hashIdx + 1)
  const slashIdx = uri.lastIndexOf('/')
  if (slashIdx !== -1) return uri.slice(slashIdx + 1)
  return uri
}

/** Get SKOS file paths from ontology-sources.json config */
function getSkosFilePaths(): string[] {
  const configPath = join(getProjectRoot(), 'ontology-sources.json')

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const skos = config.skos || []
      return skos.map((s: { path: string }) => join(getProjectRoot(), s.path))
    } catch {
      // Fall through to default
    }
  }

  return [join(getProjectRoot(), 'src', 'lib', 'ontology', 'skos-annotations.ttl')]
}
