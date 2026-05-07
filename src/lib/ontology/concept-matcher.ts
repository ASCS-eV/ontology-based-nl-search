/**
 * Concept Matcher — resolves user terms against the ontology via SKOS.
 *
 * Scientific basis:
 * - W3C SKOS (skos:prefLabel, skos:altLabel, skos:broader/narrower/related)
 *   for formal concept matching and hierarchy traversal.
 * - Jaro-Winkler distance for string similarity on unmatched terms
 *   (Winkler, 1990 — "String Comparator Metrics and Enhanced Decision Rules").
 *
 * Matching tiers:
 * 1. Exact match on prefLabel or ontology value → HIGH confidence
 * 2. Match on altLabel (synonym) → HIGH confidence
 * 3. Match via skos:broader/narrower/related → MEDIUM confidence
 * 4. String similarity > threshold → LOW confidence (reported as gap with suggestion)
 * 5. No match → reported as gap
 *
 * @see https://www.w3.org/TR/skos-reference/
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

import { lookupGlossaryBatch } from './glossary'
import { buildVocabularyIndex } from './vocabulary-index'

export interface ConceptMatch {
  /** What the user said */
  input: string
  /** The ontology property this maps to (local name, e.g., "roadTypes") */
  property: string
  /** The ontology value to use in SPARQL */
  value: string
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low'
  /** How it was matched */
  matchType: 'exact' | 'synonym' | 'related' | 'similar'
  /** If matched via related concept, the preferred label of the related concept */
  via?: string
}

export interface ConceptGap {
  /** The unmatched user term */
  term: string
  /** Why it couldn't be matched */
  reason: string
  /** Nearest concepts if any (from string similarity or related concepts) */
  suggestions: string[]
  /** Domain glossary definition if the term is a known domain concept */
  definition?: string
  /** Usage guidance from the glossary (how to achieve what user wants) */
  scopeNote?: string
  /** Whether this is a recognized domain concept (just not filterable) */
  isDomainConcept?: boolean
}

export interface MatchResult {
  /** Successfully matched concepts */
  matches: ConceptMatch[]
  /** Unresolvable terms */
  gaps: ConceptGap[]
  /** Remainder of query after removing matched terms */
  remainder: string
}

/** SKOS concept as extracted from the TTL */
interface SkosConcept {
  uri: string
  prefLabel: string
  altLabels: string[]
  ontologyProperty: string
  ontologyValue: string
  broader: string[]
  narrower: string[]
  related: string[]
}

/** Cached SKOS store */
let skosStore: Map<string, SkosConcept> | null = null
/** Label → concept URI reverse index (all labels lowercased) */
let labelIndex: Map<string, string> | null = null

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
          // Scan directory for all .ttl files
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

/** Stopwords to ignore when tokenizing user queries */
const STOPWORDS = new Set([
  'i',
  'a',
  'an',
  'the',
  'want',
  'need',
  'looking',
  'for',
  'with',
  'and',
  'or',
  'that',
  'has',
  'have',
  'having',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'of',
  'in',
  'on',
  'at',
  'to',
  'from',
  'by',
  'about',
  'like',
  'find',
  'search',
  'show',
  'me',
  'some',
  'any',
  'all',
  'get',
  'give',
  'please',
  'map',
  'maps',
  'data',
  'dataset',
  'datasets',
  'hd',
  'simulation',
  'asset',
  'assets',
  'many',
  'lots',
  'much',
])

/**
 * Load and index the SKOS concept scheme.
 * Uses Oxigraph to parse the TTL and SPARQL to extract concepts.
 */
async function loadSkosStore(): Promise<void> {
  if (skosStore) return

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

  const concepts = store.query(conceptSparql) as Map<string, any>[]
  const conceptMap = new Map<string, SkosConcept>()

  for (const row of concepts) {
    const uri = row.get('concept')?.value
    if (!uri || conceptMap.has(uri)) continue

    conceptMap.set(uri, {
      uri,
      prefLabel: row.get('prefLabel')?.value || '',
      altLabels: [],
      ontologyProperty: extractLocalName(row.get('ontologyProperty')?.value || ''),
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
  const altResults = store.query(altLabelSparql) as Map<string, any>[]
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
  const relResults = store.query(relSparql) as Map<string, any>[]
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
  const index = new Map<string, string>()
  for (const [uri, concept] of conceptMap) {
    index.set(concept.prefLabel.toLowerCase(), uri)
    index.set(concept.ontologyValue.toLowerCase(), uri)
    for (const alt of concept.altLabels) {
      index.set(alt.toLowerCase(), uri)
    }
  }

  skosStore = conceptMap
  labelIndex = index
}

/**
 * Match user natural language query against the ontology vocabulary.
 * Uses SKOS concept scheme for synonym resolution and gap detection.
 */
export async function matchConcepts(query: string): Promise<MatchResult> {
  await loadSkosStore()
  await buildVocabularyIndex()

  const matches: ConceptMatch[] = []
  const gaps: ConceptGap[] = []
  let remainder = query.toLowerCase()

  // Phase 1: Try matching multi-word phrases first (longer matches take priority)
  const allLabels = [...labelIndex!.keys()].sort((a, b) => b.length - a.length)

  for (const label of allLabels) {
    if (label.length < 2) continue
    const regex = new RegExp(`\\b${escapeRegex(label)}\\b`, 'i')
    if (regex.test(remainder)) {
      const conceptUri = labelIndex!.get(label)!
      const concept = skosStore!.get(conceptUri)
      if (concept) {
        const isExact =
          label === concept.prefLabel.toLowerCase() || label === concept.ontologyValue.toLowerCase()
        matches.push({
          input: label,
          property: concept.ontologyProperty,
          value: concept.ontologyValue,
          confidence: 'high',
          matchType: isExact ? 'exact' : 'synonym',
        })
        remainder = remainder.replace(regex, ' ').trim()
      }
    }
  }

  // Phase 2: Check remaining words for partial matches via related concepts
  remainder = remainder.replace(/\s+/g, ' ').trim()
  const remainingWords = remainder.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))

  for (const word of remainingWords) {
    // Check if word matches any concept via related/broader
    const relatedMatch = findRelatedConcept(word)
    if (relatedMatch) {
      matches.push(relatedMatch)
      remainder = remainder.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'), ' ').trim()
      continue
    }

    // Check string similarity against all ontology values
    const similarMatch = findSimilarConcept(word)
    if (similarMatch) {
      gaps.push({
        term: word,
        reason: `Not an exact ontology term; closest match: "${similarMatch.value}" (${similarMatch.property})`,
        suggestions: [similarMatch.value],
      })
      remainder = remainder.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'), ' ').trim()
    }
  }

  // Phase 3: Report remaining meaningful words as gaps
  remainder = remainder.replace(/\s+/g, ' ').trim()
  const unmatchedWords = remainder.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))

  for (const word of unmatchedWords) {
    if (!gaps.find((g) => g.term === word) && !matches.find((m) => m.input === word)) {
      gaps.push({
        term: word,
        reason: 'No matching concept found in the HD map ontology',
        suggestions: [],
      })
    }
  }

  // Phase 4: Enrich gaps with glossary context
  if (gaps.length > 0) {
    const gapTerms = gaps.map((g) => g.term)
    const glossaryEntries = await lookupGlossaryBatch(gapTerms)

    for (const gap of gaps) {
      const entry = glossaryEntries.get(gap.term)
      if (entry) {
        gap.isDomainConcept = true
        gap.definition = entry.definition
        gap.scopeNote = entry.scopeNote
        if (entry.relatedTerms.length > 0) {
          gap.suggestions = [...new Set([...gap.suggestions, ...entry.relatedTerms])]
        }
        if (!entry.filterable) {
          gap.reason = `Recognized domain concept but not a filterable property in the current ontology`
        }
      }
    }
  }

  return { matches, gaps, remainder: remainder.replace(/\s+/g, ' ').trim() }
}

/**
 * Find a concept that is related to the given word via SKOS relationships.
 * For example, "exit" → exitLane concept directly, or "ramp" → connectingRamp.
 */
function findRelatedConcept(word: string): ConceptMatch | null {
  if (!skosStore || !labelIndex) return null

  // First check if any concept's related concepts mention this word
  for (const [, concept] of skosStore) {
    for (const relatedUri of concept.related) {
      const relatedConcept = skosStore.get(relatedUri)
      if (relatedConcept) {
        const relLabels = [
          relatedConcept.prefLabel.toLowerCase(),
          ...relatedConcept.altLabels.map((l) => l.toLowerCase()),
        ]
        if (relLabels.some((l) => l === word || l.includes(word))) {
          return {
            input: word,
            property: relatedConcept.ontologyProperty,
            value: relatedConcept.ontologyValue,
            confidence: 'medium',
            matchType: 'related',
            via: concept.prefLabel,
          }
        }
      }
    }
  }

  return null
}

/**
 * Find the most similar concept using Jaro-Winkler distance.
 * Only returns a match if similarity exceeds threshold (0.85).
 *
 * Jaro-Winkler (Winkler, 1990) is preferred over Levenshtein for
 * short strings because it gives higher scores to strings matching
 * from the beginning, which aligns with how users typically
 * abbreviate or misspell concept names.
 */
function findSimilarConcept(
  word: string
): { value: string; property: string; score: number } | null {
  if (!skosStore) return null

  const THRESHOLD = 0.85
  let bestMatch: { value: string; property: string; score: number } | null = null

  for (const [, concept] of skosStore) {
    const candidates = [
      concept.prefLabel.toLowerCase(),
      concept.ontologyValue.toLowerCase(),
      ...concept.altLabels.map((l) => l.toLowerCase()),
    ]

    for (const candidate of candidates) {
      const score = jaroWinklerDistance(word, candidate)
      if (score >= THRESHOLD && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          value: concept.ontologyValue,
          property: concept.ontologyProperty,
          score,
        }
      }
    }
  }

  return bestMatch
}

/**
 * Jaro-Winkler string similarity distance.
 * Returns a value between 0 (no similarity) and 1 (exact match).
 *
 * Reference: Winkler, W. E. (1990). "String Comparator Metrics and
 * Enhanced Decision Rules in the Fellegi-Sunter Model of Record Linkage."
 */
export function jaroWinklerDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1)

  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  let matches = 0
  let transpositions = 0

  // Find matching characters
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, s2.length)

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  // Count transpositions
  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3

  // Winkler modification: boost for common prefix (up to 4 chars)
  let prefix = 0
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }

  return jaro + prefix * 0.1 * (1 - jaro)
}

/** Extract local name from IRI */
function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Reset caches (for testing) */
export function resetConceptMatcher(): void {
  skosStore = null
  labelIndex = null
}
