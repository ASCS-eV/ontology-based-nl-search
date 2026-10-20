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
  /**
   * Score of the query against the domain's own id alone — "did the user
   * name this domain?", as opposed to merely using a word that appears in
   * its vocabulary. Equal-scoring domains are ordered by this: an id is the
   * handle a user has for scoping a search, so naming it is the stronger
   * routing evidence. Generic across ontologies — every domain has an id.
   */
  nameScore: number
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

/**
 * BM25 length-normalization parameter. 0 = no normalization, 1 = fully
 * proportional to field length; 0.75 is the long-standing IR default
 * (Robertson & Zaragoza, *The Probabilistic Relevance Framework: BM25 and
 * Beyond*, §3.2). It is a retrieval-model constant, not an ontology-fitted
 * one — nothing about it changes when the ontology set is swapped.
 */
const LENGTH_NORM_B = 0.75

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

/**
 * Corpus-derived field-length statistics. Computed from the cards being
 * ranked, so nothing about any particular ontology is baked in: the same
 * code damps a media-type code list in one ontology set and whatever the
 * equivalent lexical sponge is in a swapped one.
 */
export interface CorpusStats {
  /** Mean value-field token count over cards that enumerate any values. */
  avgValueTokens: number
}

/**
 * Field-length statistics over a card corpus.
 *
 * Only cards that actually enumerate values contribute, so the mean
 * describes "how big is a typical closed vocabulary here" rather than
 * being dragged to zero by the majority of cards that enumerate nothing.
 */
export function corpusStats(cards: readonly TermCard[]): CorpusStats {
  let total = 0
  let n = 0
  for (const card of cards) {
    if (!card.allowedValues || card.allowedValues.length === 0) continue
    total += valueTokensOf(card).length
    n++
  }
  return { avgValueTokens: n === 0 ? 0 : total / n }
}

/**
 * Lexical relevance of one card for the query (0 = no signal).
 *
 * `stats` enables BM25 pivoted length normalization of the value field.
 * Without it the field is scored unnormalized — correct for a standalone
 * single-card score, where there is no corpus to be relative to.
 */
export function lexicalScore(query: string, card: TermCard, stats?: CorpusStats): number {
  return scoreFields(tokenizeQuery(query), [
    { tokens: labelTokensOf(card), weight: LABEL_WEIGHT, joinable: true },
    { tokens: valueTokensOf(card), weight: VALUE_WEIGHT * valueLengthNorm(card, stats) },
    { tokens: descriptionTokensOf(card), weight: DESCRIPTION_WEIGHT },
  ])
}

/**
 * Pivoted length normalization of the value field — the length-normalization
 * component of BM25, used on its own (no term-frequency saturation term) and
 * capped so it can only damp.
 *
 * A closed list of a few values is strong evidence: if the query word is in
 * there, it means something. A list of thousands of identifier codes (media
 * types, ISO country codes) is a lexical sponge — with that many entries
 * *some* value prefix- or trigram-matches almost any query word, so a hit
 * carries almost no evidence. Normalizing by length against the corpus mean
 * shrinks the sponge's contribution automatically.
 *
 * Capped at 1 so the factor only ever damps: a shorter-than-average list is
 * not evidence *beyond* an exact match, and leaving it uncapped would let a
 * 2-value enum outscore a label hit.
 *
 * Deliberately corpus-relative rather than an absolute size threshold: on an
 * ontology set where every vocabulary is large, length carries no signal and
 * nothing is damped — an absolute cutoff would wrongly damp all of them.
 */
function valueLengthNorm(card: TermCard, stats: CorpusStats | undefined): number {
  if (!stats || stats.avgValueTokens <= 0) return 1
  const length = valueTokensOf(card).length
  if (length === 0) return 1
  const ratio = length / stats.avgValueTokens
  return Math.min(1, 1 / (1 - LENGTH_NORM_B + LENGTH_NORM_B * ratio))
}

/** Rank cards by lexical relevance; ties break deterministically by (domain, iri). */
export function rankCards(
  query: string,
  cards: TermCard[],
  options: RankOptions = {}
): ScoredCard[] {
  const minScore = options.minScore ?? 0
  const stats = statsFor(cards)
  return cards
    .map((card) => ({ card, score: lexicalScore(query, card, stats) }))
    .filter((s) => s.score > minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.card.domain.localeCompare(b.card.domain) ||
        a.card.iri.localeCompare(b.card.iri)
    )
}

/**
 * Rank domain-catalog entries for query routing (labels + sample terms + name).
 *
 * The domain id and class labels are a joinable field: a query writing a
 * product name as separate words ("alpha label v2", "road graph") still
 * matches the joined id (`alphalabel-v2`, `roadgraph`). See
 * {@link applyJoinedSpans}.
 *
 * Ties break on {@link ScoredDomain.nameScore} first: a word can tie two
 * domains because one is *named* by it and the other merely *contains* it
 * (as a class label or a property label), and the named one is what the
 * user asked for.
 */
export function rankDomains(
  query: string,
  catalog: DomainCard[],
  options: RankOptions = {}
): ScoredDomain[] {
  const minScore = options.minScore ?? 0
  const queryTokens = tokenizeQuery(query)
  return catalog
    .map((domain) => ({
      domain,
      score: scoreFields(queryTokens, [
        { tokens: domainLabelTokensOf(domain), weight: LABEL_WEIGHT, joinable: true },
        { tokens: domainSampleTokensOf(domain), weight: VALUE_WEIGHT },
      ]),
      nameScore: scoreFields(queryTokens, [
        { tokens: domainIdTokensOf(domain), weight: LABEL_WEIGHT, joinable: true },
      ]),
    }))
    .filter((s) => s.score > minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.nameScore - a.nameScore ||
        a.domain.domain.localeCompare(b.domain.domain)
    )
}

/**
 * Tokenize free text or an identifier: lowercase, split on non-alphanumerics
 * AND camelCase boundaries (`speedLimit` → `speed`, `limit`), drop
 * single-character tokens and generic function words.
 */
export function tokenize(text: string): string[] {
  return tokenizeQuery(text).tokens
}

/**
 * Query tokens plus, for each one, how strongly it is bound to its
 * predecessor in the source text — which decides whether the two may be
 * joined into one span, and what such a join is worth.
 *
 * Tokenization drops function words and splits on punctuation, whitespace
 * and case boundaries. Recording the *original* separator before anything
 * is dropped is what keeps the span matcher honest: it can never close up
 * discarded material into an identifier the user never wrote ("a car and a
 * pet" must not exact-match a property called `carpet`), and it can
 * distinguish undoing its own split from guessing that two written words
 * name one thing.
 */
interface QueryTokens {
  tokens: string[]
  /**
   * `adjacency[i]`: the grade of the seam between token *i-1* and token
   * *i*, used directly as the match grade of any span crossing it.
   *
   * - `1` — the tokenizer itself made this cut (camelCase, `-`, `_`).
   *   Rejoining is *reconstruction*, so the span is worth an exact match.
   * - {@link PREFIX_MATCH_SCORE} — the user wrote whitespace. Rejoining is
   *   a *guess* that two words name one thing, graded like every other
   *   approximate match rather than claimed as exact.
   * - `0` — punctuation, or a dropped function word, came between. Never
   *   join.
   */
  adjacency: number[]
}

/**
 * The separator substituted at a camelCase boundary. A case boundary is an
 * identifier-*internal* seam, exactly like a hyphen or an underscore, so it
 * is normalized to one; that keeps the tokenizer's own cuts distinguishable
 * from whitespace the user typed.
 */
const CASE_BOUNDARY = '-'

/** Seams this tokenizer introduces, or that join one written identifier. */
const IDENTIFIER_SEAM = /^[-_]*$/

/** Seams the user wrote as a space between two words. */
const WORD_SEAM = /^\s+$/

function tokenizeQuery(text: string): QueryTokens {
  const normalized = text.replace(/([a-z0-9])([A-Z])/g, `$1${CASE_BOUNDARY}$2`).toLowerCase()
  const tokens: string[] = []
  const adjacency: number[] = []
  const word = /[a-z0-9]+/g
  let previousEnd = -1
  let previousKept = false
  let match: RegExpExecArray | null
  while ((match = word.exec(normalized)) !== null) {
    const raw = match[0]
    const kept = raw.length > 1 && !STOPWORDS.has(raw)
    if (kept) {
      tokens.push(raw)
      adjacency.push(
        previousKept && previousEnd >= 0 ? seamGrade(normalized.slice(previousEnd, match.index)) : 0
      )
    }
    previousEnd = match.index + raw.length
    previousKept = kept
  }
  return { tokens, adjacency }
}

function seamGrade(separator: string): number {
  if (IDENTIFIER_SEAM.test(separator)) return 1
  if (WORD_SEAM.test(separator)) return PREFIX_MATCH_SCORE
  return 0
}

// ─── Internals ───────────────────────────────────────────────────────────────

interface ScoredField {
  tokens: string[]
  weight: number
  /**
   * Identifier field: a run of adjacent query tokens may jointly match one
   * index token. Set on labels (identifiers live there), not on enum values
   * or descriptions (free text, where joining words is noise).
   */
  joinable?: boolean
}

/**
 * Tokenizations are memoized per card / per domain card. The objects are
 * built once by the term index and reused for every query, so this turns a
 * per-query re-tokenization of every enum value (thousands, for a code
 * list) into a one-off cost.
 */
const labelTokens = new WeakMap<TermCard, string[]>()
const valueTokens = new WeakMap<TermCard, string[]>()
const descriptionTokens = new WeakMap<TermCard, string[]>()
const domainLabelTokens = new WeakMap<DomainCard, string[]>()
const domainIdTokens = new WeakMap<DomainCard, string[]>()
const domainSampleTokens = new WeakMap<DomainCard, string[]>()
const prefixSets = new WeakMap<string[], Set<string>>()
const corpusStatsCache = new WeakMap<readonly TermCard[], CorpusStats>()

function memoize<K extends object>(cache: WeakMap<K, string[]>, key: K, build: () => string[]) {
  const cached = cache.get(key)
  if (cached) return cached
  const built = build()
  cache.set(key, built)
  return built
}

function labelTokensOf(card: TermCard): string[] {
  return memoize(labelTokens, card, () => card.labels.flatMap(tokenize))
}

function valueTokensOf(card: TermCard): string[] {
  return memoize(valueTokens, card, () => (card.allowedValues ?? []).flatMap(tokenize))
}

function descriptionTokensOf(card: TermCard): string[] {
  return memoize(descriptionTokens, card, () => tokenize(card.description ?? ''))
}

function domainLabelTokensOf(domain: DomainCard): string[] {
  return memoize(domainLabelTokens, domain, () =>
    [domain.domain, ...domain.classLabels].flatMap(tokenize)
  )
}

function domainSampleTokensOf(domain: DomainCard): string[] {
  return memoize(domainSampleTokens, domain, () => domain.sampleTerms.flatMap(tokenize))
}

function domainIdTokensOf(domain: DomainCard): string[] {
  return memoize(domainIdTokens, domain, () => tokenize(domain.domain))
}

/** Corpus stats for a card array, memoized on the array identity. */
function statsFor(cards: readonly TermCard[]): CorpusStats {
  const cached = corpusStatsCache.get(cards)
  if (cached) return cached
  const stats = corpusStats(cards)
  corpusStatsCache.set(cards, stats)
  return stats
}

/** Every proper prefix (and the whole token) of every token in the field. */
function prefixSetOf(tokens: string[]): Set<string> {
  const cached = prefixSets.get(tokens)
  if (cached) return cached
  const prefixes = new Set<string>()
  for (const token of tokens) {
    for (let i = 1; i <= token.length; i++) prefixes.add(token.slice(0, i))
  }
  prefixSets.set(tokens, prefixes)
  return prefixes
}

/**
 * Mean over query tokens of the best field-weighted token match. Dividing
 * by the query token count keeps scores comparable across query lengths
 * and penalizes queries that mostly miss.
 */
function scoreFields(query: QueryTokens, fields: ScoredField[]): number {
  const queryTokens = query.tokens
  if (queryTokens.length === 0) return 0
  const best = new Array<number>(queryTokens.length).fill(0)
  for (const field of fields) {
    if (field.weight <= 0 || field.tokens.length === 0) continue
    for (let i = 0; i < queryTokens.length; i++) {
      // A field's best possible contribution is its weight (an exact match).
      // If the token already scores that well, the whole field can be
      // skipped — which is what makes a damped code list cheap as well as
      // quiet: thousands of tokens are never compared.
      if (best[i]! >= field.weight) continue
      const qt = queryTokens[i]!
      let top = best[i]!
      for (const ft of field.tokens) {
        const s = tokenMatch(qt, ft) * field.weight
        if (s > top) top = s
        if (top >= field.weight) break // exact match — no better score in this field
      }
      best[i] = top
    }
    if (field.joinable) applyJoinedSpans(query, field, best)
  }
  let sum = 0
  for (const score of best) sum += score
  return sum / queryTokens.length
}

/**
 * Credit a run of adjacent query tokens that *concatenates* to one index
 * token, at the grade of the weakest seam the run crosses.
 *
 * `tokenize` splits camelCase, so a product name written as one word
 * ("AlphaLabel") becomes `alpha`+`label` while the ontology's own id
 * (`alphalabel`) stays a single token — the two sides normalize
 * asymmetrically and an explicitly named domain scores only a weak prefix
 * match. Joining spans restores symmetry without re-introducing an
 * identifier-shaped special case: it is the same mechanism for every field
 * marked joinable, in every ontology.
 *
 * Three guards keep it from inventing matches. A span may only cross seams
 * the user actually wrote ({@link QueryTokens.adjacency}), so dropped
 * function words never close up into a false identifier. It is credited at
 * the weakest seam it crosses, so only a split this tokenizer *made* is
 * repaid as an exact match — concatenating two space-separated words is
 * graded as the approximation it is, which is what stops a large ontology's
 * compound identifiers from exact-matching unrelated word pairs ("car pet"
 * → `carpet`). And it is extended only while it remains a prefix of some
 * index token, so it terminates immediately on ordinary prose and needs no
 * arbitrary bound on how many words may be joined — "alpha label v2"
 * reaches `alphalabel-v2` just as "AlphaLabel v2" does, one grade lower.
 */
function applyJoinedSpans(query: QueryTokens, field: ScoredField, best: number[]): void {
  const { tokens: queryTokens, adjacency } = query
  const indexTokens = new Set(field.tokens)
  const prefixes = prefixSetOf(field.tokens)
  for (let i = 0; i < queryTokens.length; i++) {
    let span = queryTokens[i]!
    if (!prefixes.has(span)) continue
    let grade = 1
    for (let j = i + 1; j < queryTokens.length; j++) {
      const seam = adjacency[j] ?? 0
      if (seam <= 0) break
      if (seam < grade) grade = seam
      span += queryTokens[j]!
      if (!prefixes.has(span)) break
      if (indexTokens.has(span)) {
        const credit = field.weight * grade
        for (let k = i; k <= j; k++) {
          if (best[k]! < credit) best[k] = credit
        }
      }
    }
  }
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
