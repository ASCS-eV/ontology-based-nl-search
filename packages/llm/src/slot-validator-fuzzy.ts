/**
 * Fuzzy matching & suggestion helpers (ADR 0003) — the leaf layer of slot
 * validation: tokenized similarity scoring, the bespoke Levenshtein distance
 * (ADR 0004 keep-decision), best-match selection, vocabulary indexing, and
 * nearest-vocabulary suggestions. No sibling imports.
 */
import type { SchemaVocabulary } from '@ontology-search/search'

/**
 * Minimum NORMALIZED similarity (0-1) for a fuzzy value match to be accepted.
 * Computed as `1 - editDistance/maxLen`, so the bar is length-aware: a 1-char
 * typo on an 8-char value scores 0.875 (accepted), while a short value merely
 * embedded in a longer one — "urban" in "suburban", "de" in "model" — scores
 * well below 0.8 and is correctly rejected. Replaces a raw edit-distance count
 * (+ a substring special-case) that conflated "is a substring" with "is close"
 * and accepted spurious matches with no information-theoretic meaning.
 */
const FUZZY_SIMILARITY_THRESHOLD = 0.8

/**
 * Maximum edit distance for a property-name correction to be accepted.
 * Property names are short identifiers where larger distances risk false
 * matches (e.g., "city" → "country"), so this stays an absolute bound applied
 * on top of the similarity gate.
 */
export const MAX_PROPERTY_MATCH_DISTANCE = 2

/** Maximum suggestions to generate per gap */
export const MAX_SUGGESTIONS = 5

/**
 * Minimum similarity score (0-1) to include a suggestion. Raised to
 * 0.5 in tandem with the tokenised matcher below — at 0.3 with full-
 * string Levenshtein, any two 5-character strings (no shared letters)
 * scored ~0.44 because edit distance can opportunistically align any
 * matching character anywhere. The tokenised approach + 0.5 floor
 * filters that noise cleanly.
 */
export const MIN_SUGGESTION_SIMILARITY = 0.5

/**
 * Common English / German stopwords plus a few connectives the LLM
 * sometimes echoes back in `gap.term`. We strip them before scoring
 * so a multi-word gap doesn't drag noise into the suggestion candidates.
 * Kept short and additive — anything not on the list still scores,
 * just falls below the 0.5 floor when truly unrelated.
 */
const SUGGESTION_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'for',
  'from',
  'to',
  'in',
  'on',
  'at',
  'by',
  'with',
  'without',
  'is',
  'are',
  'was',
  'were',
  'be',
  'that',
  'this',
  'these',
  'those',
  'der',
  'die',
  'das',
  'und',
  'oder',
  'mit',
  'ohne',
  'aus',
  'von',
  'für',
  'zu',
])

/**
 * Score how well a multi-word gap term matches one candidate enum
 * value. Tokenises the gap on non-alphanumeric boundaries, drops
 * short / stopword tokens, then takes the best per-token score
 * across two channels:
 *   1. Substring containment (case-insensitive) — the gap word lives
 *      inside the candidate (or vice versa for long gap words). This
 *      catches the most common shape: user says a plural or shortened term,
 *      candidate is the canonical schema label.
 *   2. Levenshtein similarity on the single token vs the candidate.
 *      Catches typo'd or stemmed variants ("europa" → "europe").
 *
 * Falls back to whole-string Levenshtein when the gap has no usable
 * tokens (e.g. an all-stopword phrase or a single short string).
 *
 * Plural stemming: drop a trailing `s` / `es` / `ies` so "maps"
 * matches "map", "categories" matches "category".
 */
export function suggestionScore(gapTerm: string, candidate: string): number {
  const candLower = candidate.toLowerCase()
  const tokens = gapTerm
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !SUGGESTION_STOPWORDS.has(t))
  if (tokens.length === 0) return similarity(gapTerm.toLowerCase(), candLower)
  let best = 0
  for (const tok of tokens) {
    const stem = tok.replace(/(ies|es|s)$/, '')
    // Containment in either direction, scored by COVERAGE — how much of the
    // longer string the shorter one spans — rather than a flat 1.0/0.9 boost.
    // A short candidate coincidentally embedded in a long gap token (e.g.
    // "co" inside "lanecount", or "urban" inside "suburbanization") then earns
    // only min/max length (0.22 / 0.33), well below the floor, instead of a
    // near-perfect score. The Levenshtein channel still catches typos.
    let tokenScore = similarity(tok, candLower)
    if (candLower.includes(stem) || stem.includes(candLower)) {
      const coverage =
        Math.min(stem.length, candLower.length) / Math.max(stem.length, candLower.length)
      tokenScore = Math.max(tokenScore, coverage)
    }
    best = Math.max(best, tokenScore)
  }
  return best
}

/**
 * Levenshtein edit distance between two strings.
 * Uses Wagner–Fischer dynamic programming (O(n×m) time, O(min(n,m)) space).
 */
function editDistance(a: string, b: string): number {
  const la = a.length
  const lb = b.length

  // Short-circuit for empty strings or identical strings
  if (la === 0) return lb
  if (lb === 0) return la
  if (a === b) return 0

  // Ensure b is shorter for O(min(n,m)) space
  if (la < lb) return editDistance(b, a)

  let prev = Array.from({ length: lb + 1 }, (_, j) => j)
  let curr = new Array<number>(lb + 1).fill(0)

  for (let i = 1; i <= la; i++) {
    curr[0] = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j]! + 1, // deletion
        curr[j - 1]! + 1, // insertion
        prev[j - 1]! + cost // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[lb]!
}

/** Normalized similarity score (0-1) based on edit distance */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - editDistance(a, b) / maxLen
}

/**
 * Extract the local name from a value that might be an IRI.
 * Returns the part after the last `/` or `#`, or the original value if it
 * doesn't look like an IRI. This enables matching LLM-proposed local names
 * (e.g., "KeepLaneAndDistance") against full IRI enum values from sh:in
 * (e.g., "https://w3id.org/.../KeepLaneAndDistance").
 */
function iriLocalName(value: string): string {
  if (!value.includes('/') && !value.includes('#')) return value
  const hashIdx = value.lastIndexOf('#')
  if (hashIdx >= 0) return value.slice(hashIdx + 1)
  const slashIdx = value.lastIndexOf('/')
  if (slashIdx >= 0) return value.slice(slashIdx + 1)
  return value
}

/**
 * Find the best fuzzy match for a value in a list of allowed values.
 * Returns null if no match within threshold.
 *
 * When allowed values are IRIs (from `@type: @vocab` enums), the LLM
 * typically proposes just the local name. This function compares against
 * both the full value AND its IRI local name to bridge the representation gap.
 */
export function findBestMatch(
  value: string,
  allowedValues: string[]
): { match: string; distance: number; similarity: number } | null {
  if (!value) return null
  const normalizedValue = value.toLowerCase().trim()

  let best: { match: string; distance: number; similarity: number } | null = null
  for (const allowed of allowedValues) {
    const normalizedAllowed = allowed.toLowerCase().trim()
    const normalizedLocalName = iriLocalName(allowed).toLowerCase().trim()

    // Exact match (case-insensitive) — full value or local name.
    if (normalizedValue === normalizedAllowed || normalizedValue === normalizedLocalName) {
      return { match: allowed, distance: 0, similarity: 1 }
    }

    // Compare against both full value and local name, take better score.
    const simFull = similarity(normalizedValue, normalizedAllowed)
    const simLocal = similarity(normalizedValue, normalizedLocalName)
    const bestSim = Math.max(simFull, simLocal)
    const bestDist =
      simFull >= simLocal
        ? editDistance(normalizedValue, normalizedAllowed)
        : editDistance(normalizedValue, normalizedLocalName)

    if (best === null || bestSim > best.similarity) {
      best = { match: allowed, distance: bestDist, similarity: bestSim }
    }
  }

  // Accept on the normalized-similarity floor. A genuine typo/plural
  // ("motoway"/"motorways" → "motorway") clears 0.8; an unrelated or merely
  // substring-overlapping value does not.
  return best !== null && best.similarity >= FUZZY_SIMILARITY_THRESHOLD ? best : null
}

/**
 * Get top-N suggestions from a property's allowed values, ranked by similarity.
 * Uses local-name matching for IRI-valued entries.
 */
export function getSuggestions(
  value: string,
  allowedValues: string[],
  max: number = MAX_SUGGESTIONS
): string[] {
  if (!value) return []
  const normalizedValue = value.toLowerCase().trim()

  return allowedValues
    .map((v) => ({
      value: v,
      score: Math.max(
        similarity(normalizedValue, v.toLowerCase()),
        similarity(normalizedValue, iriLocalName(v).toLowerCase())
      ),
    }))
    .filter((s) => s.score >= MIN_SUGGESTION_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.value)
}

/**
 * Build a lookup of property name → allowed values from vocabulary.
 * Merges allowed values from all domains when the same localName appears
 * in multiple domains.
 */
export function buildAllowedValuesIndex(
  vocabulary: SchemaVocabulary
): Map<string, { allowedValues: string[]; domain: string }> {
  const index = new Map<string, { allowedValues: string[]; domain: string }>()
  for (const prop of vocabulary.enumProperties) {
    const existing = index.get(prop.localName)
    if (existing) {
      // Merge allowed values from multiple domains (deduplicated)
      const merged = new Set([...existing.allowedValues, ...prop.allowedValues])
      existing.allowedValues = [...merged]
    } else {
      index.set(prop.localName, {
        allowedValues: [...prop.allowedValues],
        domain: prop.domain,
      })
    }
  }
  return index
}

/** Build a set of known numeric property names */
export function buildNumericPropertySet(vocabulary: SchemaVocabulary): Set<string> {
  return new Set(vocabulary.numericProperties.map((p) => p.localName))
}
