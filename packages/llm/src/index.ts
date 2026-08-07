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
import { getPrimaryDomain } from '@ontology-search/ontology/domain-registry'
import { getInitializedStore, warmupRetrievalIndex } from '@ontology-search/search'

import {
  getPersistentSession,
  primeCacheInBackground,
  runCopilotAgent,
} from './agent/copilot-agent.js'
import { runSparqlAgent, warmupAgentPrompt } from './agent/index.js'
import { verifyProviderAccess } from './provider-access.js'
import { providerContextFromConfig, withProviderErrorTranslation } from './provider-errors.js'

export { warmupAgentPrompt }
import type { LlmStructuredResponse } from '@ontology-search/search/types'

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
 * Check at startup that the configured LLM provider can actually be used —
 * credentials readable, endpoint reachable, model served — so a
 * misconfiguration is reported while the operator is still watching the
 * server start, instead of by the first user's first query.
 *
 * For Copilot the check IS creating the session (which authenticates), so
 * that also primes the pool and the prompt cache.
 *
 * Throws an {@link @ontology-search/core/errors!AgentError} naming the setting
 * and the command that fixes it. Callers treat that as a WARNING rather than a
 * failed startup: everything except natural-language search still works
 * without a provider, and a provider that comes back (Ollama started, session
 * re-authenticated) needs no restart. See `apps/api/src/warmup.ts`.
 */
export async function verifyLlmProvider(): Promise<void> {
  const config = getConfig()
  if (config.AI_PROVIDER === 'copilot') {
    // Same translation the request path gets: an unauthenticated SDK reports
    // its own transport-level failure, which says nothing about GITHUB_TOKEN
    // or `gh auth token`.
    await withProviderErrorTranslation(providerContextFromConfig(config), () =>
      getPersistentSession()
    )
    // Non-blocking one-shot prompt-cache prime. Readiness is not delayed;
    // requests arriving before priming completes just pay the cold cost once,
    // exactly as before. No recurring keep-alive (no idle token cost).
    primeCacheInBackground()
    return
  }
  await verifyProviderAccess()
}

/**
 * Pre-populate the LLM session-level caches so the first user query doesn't
 * pay any cold-start cost:
 *
 *  - Agent context (`warmupAgentPrompt`): schema-only vocabulary + store.
 *  - Retrieval term index: built once so the per-query retrieval stage
 *    starts hot.
 *
 * Provider reachability is NOT checked here — see {@link verifyLlmProvider},
 * which the API runs as its own warmup step because the two failures mean
 * different things for readiness.
 */
export async function warmupLlmSession(): Promise<void> {
  await warmupAgentPrompt()
  // Build the term index up front so the first query's retrieval stage
  // pays no index cost.
  await warmupRetrievalIndex(await getInitializedStore())
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

  // One choke point for provider faults: an unreachable Ollama, a rejected
  // key, or a model that was never pulled becomes an AgentError naming the
  // setting and the command, instead of the SDK's transport-level wording.
  return withProviderErrorTranslation(providerContextFromConfig(config), () =>
    config.AI_PROVIDER === 'copilot'
      ? runCopilotAgent(naturalLanguageQuery, { domain, signal })
      : runSparqlAgent(naturalLanguageQuery, { domain, signal })
  )
}
