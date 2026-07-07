/**
 * Shared Agent Context — deduplicated vocabulary + store cache, and the
 * per-request prompt seam.
 *
 * Both the Vercel adapter and the Copilot adapter need the same things
 * before invoking the LLM:
 *   1. The schema-only ontology vocabulary (for post-LLM slot validation)
 *   2. A SparqlStore reference (for running post-LLM SHACL validation)
 *   3. A per-request system prompt: the byte-stable static core plus the
 *      schema context retrieved for the query
 *
 * This module is the single owner of that cache and that seam, so the two
 * adapters cannot drift — a bug fixed here is fixed for both.
 */

import {
  extractSchemaVocabulary,
  getInitializedStore,
  type RetrievedSchema,
  retrieveRelevantSchema,
  type SchemaVocabulary,
  type SparqlStore,
} from '@ontology-search/search'

import { composeRetrievedSections, joinPromptParts } from '../prompt/compose.js'
import { buildStaticCore } from '../prompt/static-core.js'

// ─── Module-private singleton cache ──────────────────────────────────────────

let cachedVocabulary: SchemaVocabulary | null = null
let cachedStore: SparqlStore | null = null

export interface AgentContext {
  vocabulary: SchemaVocabulary
  store: SparqlStore
}

/**
 * Get the shared agent context (vocabulary + store).
 *
 * Cached after first build — the ontology doesn't change at runtime.
 * Both adapters call this; no duplication. The vocabulary is schema-only:
 * instance-value distributions are fetched lazily by the validators that
 * need them, so warmup performs zero instance-data queries here.
 */
export async function getAgentContext(): Promise<AgentContext> {
  if (cachedVocabulary && cachedStore) {
    return { vocabulary: cachedVocabulary, store: cachedStore }
  }

  const store = await getInitializedStore()
  cachedVocabulary = await extractSchemaVocabulary(store)
  cachedStore = store

  return { vocabulary: cachedVocabulary, store: cachedStore }
}

/**
 * Pre-populate the agent context during startup warmup so the first user
 * query doesn't pay the vocabulary-extraction cost.
 *
 * No-op when the cache is already populated.
 */
export async function warmupAgentContext(): Promise<void> {
  await getAgentContext()
}

// ─── Per-request prompts ─────────────────────────────────────────────────────

/** The cached, byte-stable static prompt core (query-independent sections). */
export { buildStaticCore as getStaticCore } from '../prompt/static-core.js'

export interface RequestPromptResult {
  /** Full composed system prompt: static core + retrieved tail (Vercel path). */
  prompt: string
  /**
   * The query-dependent tail alone — for adapters whose sessions already
   * carry the static core as their baked system message (Copilot path).
   */
  tail: string
  retrieved: RetrievedSchema
}

export interface BuildRequestPromptOptions {
  /** Cancels the retrieval's schema queries on client abort. */
  signal?: AbortSignal
  /** Retrieval budgets — wired from the agent policy. */
  maxDomains?: number
  maxCards?: number
  /** false = distilled cards instead of raw SHACL fragments. */
  includeFragments?: boolean
}

/**
 * Build the per-request system prompt: static core + schema context
 * retrieved for THIS query. The single seam both agent adapters call —
 * no per-adapter prompt logic. Returns the retrieval result alongside so
 * callers can surface retrieval metadata in timings/diagnostics.
 *
 * The raw query text is consumed by retrieval only — it is never
 * interpolated into the system prompt (see `composePrompt`).
 */
export async function buildRequestPrompt(
  query: string,
  options: BuildRequestPromptOptions = {}
): Promise<RequestPromptResult> {
  const store = await getInitializedStore()
  const retrieved = await retrieveRelevantSchema(store, query, {
    signal: options.signal,
    maxDomains: options.maxDomains,
    maxCards: options.maxCards,
    includeFragments: options.includeFragments,
  })
  const tail = composeRetrievedSections(retrieved)
  return { prompt: joinPromptParts(buildStaticCore(), tail), tail, retrieved }
}
