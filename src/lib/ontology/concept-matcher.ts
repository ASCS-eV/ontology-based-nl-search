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
import { lookupGlossaryBatch } from './glossary'
import type { SkosIndex } from './skos-loader'
import { loadSkosIndex, resetSkosIndex } from './skos-loader'
import { jaroWinklerDistance } from './string-similarity'
import { buildVocabularyIndex } from './vocabulary-index'

// Re-export for public API backward compatibility
export { jaroWinklerDistance } from './string-similarity'

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
  /** Domain this concept belongs to (e.g., "hdmap", "scenario") */
  domain?: string
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

/** Similarity threshold for Jaro-Winkler fuzzy matching */
const SIMILARITY_THRESHOLD = 0.85

/**
 * Match user natural language query against the ontology vocabulary.
 * Uses SKOS concept scheme for synonym resolution and gap detection.
 */
export async function matchConcepts(query: string): Promise<MatchResult> {
  const index = await loadSkosIndex()
  await buildVocabularyIndex()

  const matches: ConceptMatch[] = []
  const gaps: ConceptGap[] = []
  let remainder = query.toLowerCase()

  // Phase 1: Try matching multi-word phrases first (longer matches take priority)
  const allLabels = [...index.labelIndex.keys()].sort((a, b) => b.length - a.length)

  for (const label of allLabels) {
    if (label.length < 2) continue
    const regex = new RegExp(`\\b${escapeRegex(label)}\\b`, 'i')
    if (regex.test(remainder)) {
      const conceptUri = index.labelIndex.get(label)!
      const concept = index.concepts.get(conceptUri)
      if (concept) {
        const isExact =
          label === concept.prefLabel.toLowerCase() || label === concept.ontologyValue.toLowerCase()
        matches.push({
          input: label,
          property: concept.ontologyProperty,
          value: concept.ontologyValue,
          confidence: 'high',
          matchType: isExact ? 'exact' : 'synonym',
          domain: concept.domain,
        })
        remainder = remainder.replace(regex, ' ').trim()
      }
    }
  }

  // Phase 2: Check remaining words for partial matches via related concepts
  remainder = remainder.replace(/\s+/g, ' ').trim()
  const remainingWords = remainder.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))

  for (const word of remainingWords) {
    const relatedMatch = findRelatedConcept(word, index)
    if (relatedMatch) {
      matches.push(relatedMatch)
      remainder = remainder.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'), ' ').trim()
      continue
    }

    const similarMatch = findSimilarConcept(word, index)
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
        reason: 'No matching concept found in the ontology',
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

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Find a concept that is related to the given word via SKOS relationships.
 */
function findRelatedConcept(word: string, index: SkosIndex): ConceptMatch | null {
  for (const [, concept] of index.concepts) {
    for (const relatedUri of concept.related) {
      const relatedConcept = index.concepts.get(relatedUri)
      if (relatedConcept) {
        const relLabels = [
          relatedConcept.prefLabel.toLowerCase(),
          ...relatedConcept.altLabels.map((l: string) => l.toLowerCase()),
        ]
        if (relLabels.some((l: string) => l === word || l.includes(word))) {
          return {
            input: word,
            property: relatedConcept.ontologyProperty,
            value: relatedConcept.ontologyValue,
            confidence: 'medium',
            matchType: 'related',
            via: concept.prefLabel,
            domain: relatedConcept.domain,
          }
        }
      }
    }
  }

  return null
}

/**
 * Find the most similar concept using Jaro-Winkler distance.
 * Only returns a match if similarity exceeds threshold.
 */
function findSimilarConcept(
  word: string,
  index: SkosIndex
): { value: string; property: string; score: number } | null {
  let bestMatch: { value: string; property: string; score: number } | null = null

  for (const [, concept] of index.concepts) {
    const candidates = [
      concept.prefLabel.toLowerCase(),
      concept.ontologyValue.toLowerCase(),
      ...concept.altLabels.map((l: string) => l.toLowerCase()),
    ]

    for (const candidate of candidates) {
      const score = jaroWinklerDistance(word, candidate)
      if (score >= SIMILARITY_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Reset all caches (for testing) */
export function resetConceptMatcher(): void {
  resetSkosIndex()
}
