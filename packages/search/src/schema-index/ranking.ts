/**
 * Pure lexical ranking over term cards and domain catalogs — no I/O, fully
 * deterministic.
 *
 * The scorer is a pragmatic hybrid of exact / prefix / trigram-similarity
 * token matching with per-field weights (labels > enum values >
 * descriptions). It is intentionally NOT tuned to any ontology: all signal
 * comes from the cards' own labels, values, and descriptions, so it works
 * unchanged on a swapped ontology set.
 */
import type { DomainCard, TermCard } from './term-index.js'

/** A card (or domain) with its query-relevance score, higher = better. */
export interface ScoredCard {
  card: TermCard
  score: number
}

export interface ScoredDomain {
  domain: DomainCard
  score: number
}

export interface RankOptions {
  /** Keep only entries scoring strictly above this (default 0). */
  minScore?: number
}

// Field weights: a query token naming a property label is the strongest
// signal; naming an enum VALUE is nearly as strong (value-first
// disambiguation — "motorway" should pull `roadTypes`); descriptions are
// wordier and noisier.
const LABEL_WEIGHT = 1
const VALUE_WEIGHT = 0.7
const DESCRIPTION_WEIGHT = 0.4

/** Minimum trigram Dice similarity that still counts as a fuzzy match. */
const MIN_TRIGRAM_SIMILARITY = 0.5
/** Score awarded to a prefix (non-exact) token match. */
const PREFIX_MATCH_SCORE = 0.7

/**
 * Generic English function words that carry no schema signal. This is a
 * language-level list, not an ontology-level one — it contains no domain,
 * class, or property names.
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'for',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])

/** Lexical relevance of one card for the query (0 = no signal). */
export function lexicalScore(query: string, card: TermCard): number {
  return scoreFields(tokenize(query), [
    { tokens: card.labels.flatMap(tokenize), weight: LABEL_WEIGHT },
    { tokens: (card.allowedValues ?? []).flatMap(tokenize), weight: VALUE_WEIGHT },
    { tokens: tokenize(card.description ?? ''), weight: DESCRIPTION_WEIGHT },
  ])
}

/** Rank cards by lexical relevance; ties break deterministically by (domain, iri). */
export function rankCards(
  query: string,
  cards: TermCard[],
  options: RankOptions = {}
): ScoredCard[] {
  const minScore = options.minScore ?? 0
  return cards
    .map((card) => ({ card, score: lexicalScore(query, card) }))
    .filter((s) => s.score > minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.card.domain.localeCompare(b.card.domain) ||
        a.card.iri.localeCompare(b.card.iri)
    )
}

/** Rank domain-catalog entries for query routing (labels + sample terms + name). */
export function rankDomains(
  query: string,
  catalog: DomainCard[],
  options: RankOptions = {}
): ScoredDomain[] {
  const minScore = options.minScore ?? 0
  const queryTokens = tokenize(query)
  return catalog
    .map((domain) => ({
      domain,
      score: scoreFields(queryTokens, [
        { tokens: [domain.domain, ...domain.classLabels].flatMap(tokenize), weight: LABEL_WEIGHT },
        { tokens: domain.sampleTerms.flatMap(tokenize), weight: VALUE_WEIGHT },
      ]),
    }))
    .filter((s) => s.score > minScore)
    .sort((a, b) => b.score - a.score || a.domain.domain.localeCompare(b.domain.domain))
}

/**
 * Tokenize free text or an identifier: lowercase, split on non-alphanumerics
 * AND camelCase boundaries (`speedLimit` → `speed`, `limit`), drop
 * single-character tokens and generic function words.
 */
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

// ─── Internals ───────────────────────────────────────────────────────────────

interface ScoredField {
  tokens: string[]
  weight: number
}

/**
 * Mean over query tokens of the best field-weighted token match. Dividing
 * by the query token count keeps scores comparable across query lengths
 * and penalizes queries that mostly miss.
 */
function scoreFields(queryTokens: string[], fields: ScoredField[]): number {
  if (queryTokens.length === 0) return 0
  let sum = 0
  for (const qt of queryTokens) {
    let best = 0
    for (const field of fields) {
      for (const ft of field.tokens) {
        const s = tokenMatch(qt, ft) * field.weight
        if (s > best) best = s
        if (best >= field.weight) break // exact match — no better score in this field
      }
    }
    sum += best
  }
  return sum / queryTokens.length
}

/** Exact (1) > prefix (0.7) > trigram Dice ≥ 0.5, else 0. */
function tokenMatch(a: string, b: string): number {
  if (a === b) return 1
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) {
    return PREFIX_MATCH_SCORE
  }
  const similarity = diceCoefficient(a, b)
  return similarity >= MIN_TRIGRAM_SIMILARITY ? similarity * PREFIX_MATCH_SCORE : 0
}

/** Sørensen–Dice coefficient over character trigrams (padded). */
function diceCoefficient(a: string, b: string): number {
  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return (2 * shared) / (ta.size + tb.size)
}

function trigrams(token: string): Set<string> {
  const padded = `  ${token} `
  const grams = new Set<string>()
  for (let i = 0; i <= padded.length - 3; i++) grams.add(padded.slice(i, i + 3))
  return grams
}
