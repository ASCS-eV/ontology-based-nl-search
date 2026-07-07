/**
 * Retrieval API — the query-time entry point of schema retrieval: given a
 * natural-language query, return the ranked, minimal set of domains + term
 * cards + SHACL fragments the LLM needs (epic #120, task 05).
 *
 * Generic and schema-only by construction: every signal comes from the
 * term index (built from the schema graph + context lexicon), ranking is
 * pure lexical by default with a pluggable embedding rerank, and fragments
 * are extracted per selected property from `urn:graph:schema`
 * ([SPARQL11]). Instance data is never touched — data gaps stay
 * discoverable downstream.
 *
 * Gap preservation: the compact domain catalog is ALWAYS attached, so the
 * LLM can distinguish "few cards retrieved" from "term absent from the
 * ontology" and report ontology gaps honestly.
 */
import type { SparqlStore } from '@ontology-search/sparql/types'

import { type EmbeddingProvider, lexicalOnlyProvider } from './embedding.js'
import { extractShaclFragments, type ShaclFragment } from './fragment-extractor.js'
import { rankCards, rankDomains, type ScoredCard } from './ranking.js'
import { buildTermIndex, type DomainCard, type TermCard } from './term-index.js'

export interface RetrievalOptions {
  /** Route to at most this many primary domains. */
  maxDomains?: number
  /** Card budget across the routed domains. */
  maxCards?: number
  /** Extract SHACL fragments for the selected properties (default true). */
  includeFragments?: boolean
  /** Optional embedding rerank; default is the offline lexical-only provider. */
  embedding?: EmbeddingProvider
  /** Cancels in-flight schema queries (SSE close, request abort). */
  signal?: AbortSignal
}

export interface RetrievedSchema {
  /** Routed primary domains, highest signal first. */
  domains: string[]
  /** Selected cards: routed domains first, then transitive dependencies. */
  cards: TermCard[]
  /** Minimal SHACL for the selected properties; empty in distilled mode. */
  fragments: ShaclFragment[]
  /**
   * How sure retrieval is that the query matched the loaded schema:
   * `max(top domain-catalog score, top card score)`, clamped to [0, 1].
   * A query naming a property or value scores via cards even when domain
   * routing is fuzzy; a query naming only a domain scores via the catalog;
   * nonsense scores near 0. Callers widen or fall back below their
   * threshold (see the agent-integration flag) — retrieval itself never
   * fails a low-confidence query.
   */
  confidence: number
  /** The full domain catalog — always attached for honest gap reporting. */
  catalog: DomainCard[]
}

const DEFAULT_MAX_DOMAINS = 3
const DEFAULT_MAX_CARDS = 40
/** Transitive dependency expansion depth over referencesDomain edges. */
const MAX_EXPANSION_DEPTH = 2
/** Card budget per transitively-pulled dependency domain. */
const REFERENCED_DOMAIN_CARDS = 10
/** Lexical candidates handed to the embedding rerank (when plugged in). */
const RERANK_WINDOW_FACTOR = 3

/**
 * Retrieve the minimal relevant schema context for a query. One call —
 * routing, card selection, transitive dependency expansion, fragments.
 */
export async function retrieveRelevantSchema(
  store: SparqlStore,
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievedSchema> {
  options.signal?.throwIfAborted()
  const maxDomains = options.maxDomains ?? DEFAULT_MAX_DOMAINS
  const maxCards = options.maxCards ?? DEFAULT_MAX_CARDS
  const includeFragments = options.includeFragments ?? true
  const embedding = options.embedding ?? lexicalOnlyProvider

  const index = await buildTermIndex(store)

  // ── Route: domain-catalog match ∪ domains of strong card matches ───────
  // Catalog sample terms are bounded (8), so a query naming a property
  // outside the sample must still light its domain — card scores fill that
  // recall hole.
  const domainRanking = rankDomains(query, index.domainCatalog)
  const cardRanking = await rerank(query, rankCards(query, index.cards), embedding, maxCards)

  const domainSignal = new Map<string, number>()
  for (const { domain, score } of domainRanking) {
    domainSignal.set(domain.domain, score)
  }
  for (const { card, score } of cardRanking) {
    const existing = domainSignal.get(card.domain) ?? 0
    if (score > existing) domainSignal.set(card.domain, score)
  }
  const domains = [...domainSignal.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxDomains)
    .map(([domain]) => domain)

  const confidence = Math.min(1, Math.max(domainRanking[0]?.score ?? 0, cardRanking[0]?.score ?? 0))

  // ── Select cards: ranked matches first, then pad with the routed ────────
  // domains' remaining cards (deterministic index order) up to the budget.
  // Generous-by-default: a single-domain query effectively sees its whole
  // domain, which is what makes retrieval recall robust.
  const routed = new Set(domains)
  const selected: TermCard[] = []
  const selectedKeys = new Set<string>()
  const push = (card: TermCard): void => {
    const key = `${card.domain}|${card.kind}|${card.iri}`
    if (selectedKeys.has(key)) return
    selectedKeys.add(key)
    selected.push(card)
  }
  for (const { card } of cardRanking) {
    if (selected.length >= maxCards) break
    if (routed.has(card.domain)) push(card)
  }
  for (const domain of domains) {
    if (selected.length >= maxCards) break
    for (const card of index.byDomain.get(domain) ?? []) {
      if (selected.length >= maxCards) break
      push(card)
    }
  }

  // ── Transitive dependency expansion (bounded depth) ─────────────────────
  // A selected object property pointing at another domain pulls a small
  // slice of that domain too (class card + top cards), so cross-references
  // (e.g. asset → manifest → external ontology) are explorable without
  // loading whole external ontologies.
  let frontier = selected
  const visited = new Set(domains)
  for (let depth = 0; depth < MAX_EXPANSION_DEPTH; depth++) {
    const nextDomains = new Set<string>()
    for (const card of frontier) {
      if (card.referencesDomain && !visited.has(card.referencesDomain)) {
        nextDomains.add(card.referencesDomain)
      }
    }
    if (nextDomains.size === 0) break
    const added: TermCard[] = []
    for (const domain of [...nextDomains].sort()) {
      visited.add(domain)
      const domainCards = index.byDomain.get(domain) ?? []
      const slice: TermCard[] = []
      const sliceIris = new Set<string>()
      const take = (card: TermCard): void => {
        if (sliceIris.has(card.iri)) return
        sliceIris.add(card.iri)
        slice.push(card)
      }
      // The dependency slice: the domain's class card, its query-relevant
      // cards, then leading cards in deterministic order up to the budget.
      const classCard = domainCards.find((c) => c.kind === 'class')
      if (classCard) take(classCard)
      for (const { card } of cardRanking) {
        if (slice.length > REFERENCED_DOMAIN_CARDS) break
        if (card.domain === domain) take(card)
      }
      for (const card of domainCards) {
        if (slice.length > REFERENCED_DOMAIN_CARDS) break
        take(card)
      }
      added.push(...slice)
    }
    for (const card of added) push(card)
    frontier = added
  }

  // ── Fragments: per selected property, shape-agnostic ────────────────────
  // Property-only selection so nested (non-target-class) shapes that
  // declare the path are included; class context rides in the catalog.
  options.signal?.throwIfAborted()
  let fragments: ShaclFragment[] = []
  if (includeFragments) {
    const propertyIris = [
      ...new Set(selected.filter((c) => c.kind === 'property').map((c) => c.iri)),
    ]
    fragments = await extractShaclFragments(store, { propertyIris }, { signal: options.signal })
  }

  return { domains, cards: selected, fragments, confidence, catalog: index.domainCatalog }
}

/**
 * Pre-build the term index (and let the embedding provider warm itself)
 * so the first query pays no index cost. Called from warmup when the
 * retrieval mode is enabled.
 */
export async function warmupRetrievalIndex(
  store: SparqlStore,
  embedding: EmbeddingProvider = lexicalOnlyProvider
): Promise<void> {
  await buildTermIndex(store)
  await embedding.embed([])
}

/**
 * Optional embedding rerank over the lexical top window: blends cosine
 * similarity with the lexical score 50/50 for candidates the provider
 * embeds; providers returning empty vectors (the offline default) leave
 * the lexical order untouched.
 */
async function rerank(
  query: string,
  ranking: ScoredCard[],
  embedding: EmbeddingProvider,
  maxCards: number
): Promise<ScoredCard[]> {
  const window = ranking.slice(0, maxCards * RERANK_WINDOW_FACTOR)
  if (window.length === 0 || embedding === lexicalOnlyProvider) return ranking

  const texts = [query, ...window.map((s) => cardText(s.card))]
  const vectors = await embedding.embed(texts)
  const queryVector = vectors[0]
  if (!queryVector || queryVector.length === 0) return ranking

  const blended = window.map((s, i) => {
    const v = vectors[i + 1]
    if (!v || v.length === 0) return s
    return { card: s.card, score: 0.5 * s.score + 0.5 * cosine(queryVector, v) }
  })
  blended.sort(
    (a, b) =>
      b.score - a.score ||
      a.card.domain.localeCompare(b.card.domain) ||
      a.card.iri.localeCompare(b.card.iri)
  )
  return [...blended, ...ranking.slice(window.length)]
}

function cardText(card: TermCard): string {
  return [...card.labels, card.description ?? ''].join(' ')
}

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}
