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
  extractVocabulary,
  getInitializedStore,
  type OntologyVocabulary,
  type SparqlStore,
} from '@ontology-search/search'
import { getShaclContent } from '@ontology-search/search/shacl-reader'

import { buildSystemPrompt } from '../prompt-builder.js'

// ─── Module-private singleton cache ──────────────────────────────────────────

let cachedPrompt: string | null = null
let cachedVocabulary: OntologyVocabulary | null = null
let cachedStore: SparqlStore | null = null

export interface AgentContext {
  prompt: string
  vocabulary: OntologyVocabulary
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

  // Extract vocabulary separately — needed for post-LLM slot validation
  const store = await getInitializedStore()
  cachedVocabulary = await extractVocabulary(store)
  cachedStore = store

  return { prompt: cachedPrompt, vocabulary: cachedVocabulary, store: cachedStore }
}

/**
 * Pre-populate the agent context during startup warmup so the first user
 * query doesn't pay the SHACL-read + buildSystemPrompt + extractVocabulary
 * cost (tens of seconds on a cold start).
 *
 * No-op when the cache is already populated.
 */
export async function warmupAgentContext(): Promise<void> {
  await getAgentContext()
}
