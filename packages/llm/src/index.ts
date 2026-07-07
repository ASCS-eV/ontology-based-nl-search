/**
 * Public surface of `@ontology-search/llm`.
 *
 * Exports (declared in `package.json` `exports`):
 *   - `.`       → this file (high-level facade)
 *   - `./types` → `LlmStructuredResponse`, `OntologyGap`, …
 *
 * The `agent/` subdirectory is intentionally NOT exported as a subpath —
 * its contents are implementation details of `generateStructuredSearch`.
 * External consumers must go through this facade so the internals can be
 * refactored (provider added/removed, tool schema reshaped) without
 * breaking downstream packages.
 */
import { getConfig } from '@ontology-search/core/config'
import {
  getInitializedStore,
  getPrimaryDomain,
  warmupRetrievalIndex,
} from '@ontology-search/search'

import {
  getPersistentSession,
  primeCacheInBackground,
  runCopilotAgent,
} from './agent/copilot-agent.js'
import { runSparqlAgent, warmupAgentPrompt } from './agent/index.js'

export { warmupAgentPrompt }
import type { LlmStructuredResponse } from './types.js'

// Re-export the SHACL slot-validation helpers so the api app can use the
// same gate in its /refine composition root without depending on internal
// modules.
export type { InstanceValueLookup, ShaclSlotValidationResult } from './slot-validator.js'
export { validateRangesAgainstShacl, validateSlotsAgainstShacl } from './slot-validator.js'

export interface SearchOptions {
  domain?: string
  /**
   * Cancel the in-flight LLM call when the caller aborts (SSE close, request
   * cancel, etc.). Honoured natively by the Vercel-SDK provider; the Copilot
   * provider races `sendAndWait` against the signal and bails on abort but
   * cannot interrupt SDK work already in flight on the shared session.
   */
  signal?: AbortSignal
}

/**
 * Pre-populate the LLM session-level caches so the first user query
 * doesn't pay any cold-start cost:
 *
 *  - Agent context (`warmupAgentPrompt`): schema-only vocabulary + store.
 *  - Retrieval term index: built once so the per-query retrieval stage
 *    starts hot.
 *  - Copilot SDK session pool: ~6s session-create cost, paid in the
 *    background. Only relevant for the Copilot provider.
 *  - Copilot prompt cache: primed ONCE in the background so the first real
 *    query doesn't pay the static-core cold prefill. Not kept warm on a
 *    timer — periodic re-priming would incur continuous LLM token cost on
 *    an idle deployment; an idle instance just pays the one-time cold cost
 *    again after the backend cache TTL expires.
 */
export async function warmupLlmSession(): Promise<void> {
  const config = getConfig()
  await warmupAgentPrompt()
  // Build the term index up front so the first query's retrieval stage
  // pays no index cost.
  await warmupRetrievalIndex(await getInitializedStore())
  if (config.AI_PROVIDER === 'copilot') {
    await getPersistentSession()
    // Non-blocking one-shot prompt-cache prime. Readiness is not delayed;
    // requests arriving before priming completes just pay the cold cost once,
    // exactly as before. No recurring keep-alive (no idle token cost).
    primeCacheInBackground()
  }
}

/**
 * Translate a natural language query into a structured response containing
 * interpretation, ontology gaps, and SPARQL query.
 *
 * All providers now use the agentic tool-use flow:
 * - openai/ollama: Vercel AI SDK tool calling
 * - copilot: Native Copilot SDK tool calling
 */
export async function generateStructuredSearch(
  naturalLanguageQuery: string,
  options?: SearchOptions
): Promise<LlmStructuredResponse> {
  const config = getConfig()
  const domain = options?.domain ?? (await getPrimaryDomain())
  const signal = options?.signal

  if (config.AI_PROVIDER === 'copilot') {
    return runCopilotAgent(naturalLanguageQuery, { domain, signal })
  }

  return runSparqlAgent(naturalLanguageQuery, { domain, signal })
}
