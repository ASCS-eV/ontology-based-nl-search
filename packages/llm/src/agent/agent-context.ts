/**
 * Shared Agent Context — deduplicated system-prompt + vocabulary + store cache.
 *
 * Both the Vercel adapter and the Copilot adapter need the same three things
 * before invoking the LLM:
 *   1. The system prompt (built from raw SHACL Turtle)
 *   2. The ontology vocabulary (for post-LLM slot validation)
 *   3. A SparqlStore reference (for running post-LLM SHACL validation)
 *
 * This module is the single owner of that cache, so the two adapters cannot
 * drift — a bug fixed here is fixed for both.
 */

import {
  extractSchemaVocabulary,
  getInitializedStore,
  type RetrievedSchema,
  retrieveRelevantSchema,
  type SchemaVocabulary,
  type SparqlStore,
} from '@ontology-search/search'
import { getShaclContent } from '@ontology-search/search/shacl-reader'

import { composePrompt } from '../prompt/compose.js'
import { buildStaticCore } from '../prompt/static-core.js'
import { buildSystemPrompt } from '../prompt-builder.js'

// ─── Module-private singleton cache ──────────────────────────────────────────

let cachedPrompt: string | null = null
let cachedVocabulary: SchemaVocabulary | null = null
let cachedStore: SparqlStore | null = null

export interface AgentContext {
  prompt: string
  vocabulary: SchemaVocabulary
  store: SparqlStore
}

/**
 * Get the shared agent context (prompt + vocabulary + store).
 *
 * Cached after first build — the ontology doesn't change at runtime.
 * Both adapters call this; no duplication.
 */
export async function getAgentContext(): Promise<AgentContext> {
  if (cachedPrompt && cachedVocabulary && cachedStore) {
    return { prompt: cachedPrompt, vocabulary: cachedVocabulary, store: cachedStore }
  }

  // Read raw SHACL files for the system prompt (LLM reads native Turtle)
  const shaclContent = getShaclContent()
  cachedPrompt = buildSystemPrompt(shaclContent)

  // Extract the schema-only vocabulary — needed for post-LLM slot validation.
  // Deliberately NOT the eager `extractVocabulary`: instance-value
  // distributions are fetched lazily by the validators that need them, so
  // warmup performs zero instance-data queries for vocabulary (issue #121).
  const store = await getInitializedStore()
  cachedVocabulary = await extractSchemaVocabulary(store)
  cachedStore = store

  return { prompt: cachedPrompt, vocabulary: cachedVocabulary, store: cachedStore }
}

/**
 * Pre-populate the agent context during startup warmup so the first user
 * query doesn't pay the SHACL-read + buildSystemPrompt +
 * extractSchemaVocabulary cost (tens of seconds on a cold start).
 *
 * No-op when the cache is already populated.
 */
export async function warmupAgentContext(): Promise<void> {
  await getAgentContext()
}

// ─── Retrieval-mode request prompts (epic #120, task 06) ─────────────────────

/** The cached, byte-stable static prompt core (query-independent sections). */
export { buildStaticCore as getStaticCore } from '../prompt/static-core.js'

export interface RequestPromptResult {
  prompt: string
  retrieved: RetrievedSchema
}

export interface BuildRequestPromptOptions {
  /** Cancels the retrieval's schema queries on client abort. */
  signal?: AbortSignal
  /** Retrieval budgets — wired from config by the agent integration (07). */
  maxDomains?: number
  maxCards?: number
  /** false = distilled cards instead of raw SHACL fragments. */
  includeFragments?: boolean
}

/**
 * Build the per-request system prompt for retrieval mode: static core +
 * schema context retrieved for THIS query. The single seam both agent
 * adapters call (no per-adapter prompt logic), returning the retrieval
 * result alongside so callers can inspect `confidence` for fallback and
 * surface retrieval metadata in timings/diagnostics.
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
  return { prompt: composePrompt(buildStaticCore(), retrieved), retrieved }
}
