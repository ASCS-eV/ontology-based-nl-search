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
  type SchemaVocabulary,
  type SparqlStore,
} from '@ontology-search/search'
import { getShaclContent } from '@ontology-search/search/shacl-reader'

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
