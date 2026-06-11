/**
 * Public surface of `@ontology-search/llm`.
 *
 * Exports (declared in `package.json` `exports`):
 *   - `.`               → this file (high-level facade)
 *   - `./types`         → `LlmStructuredResponse`, `OntologyGap`, …
 *   - `./prompt-builder` → `buildSystemPrompt`, `ShaclDomainContent`
 *
 * The `agent/` subdirectory is intentionally NOT exported as a subpath —
 * its contents are implementation details of `generateStructuredSearch`.
 * External consumers must go through this facade so the internals can be
 * refactored (provider added/removed, tool schema reshaped) without
 * breaking downstream packages.
 */
import { getConfig } from '@ontology-search/core/config'
import { getPrimaryDomain } from '@ontology-search/search'

import { getPersistentSession, runCopilotAgent } from './agent/copilot-agent.js'
import { runSparqlAgent, warmupAgentPrompt } from './agent/index.js'

export { warmupAgentPrompt }
import type { LlmStructuredResponse } from './types.js'

// Re-export the SHACL slot-validation helpers so the api app can use the
// same gate in its /refine composition root without depending on internal
// modules.
export type { ShaclSlotValidationResult } from './slot-validator.js'
export {
  correctFilters,
  validateRangesAgainstShacl,
  validateSlotsAgainstShacl,
} from './slot-validator.js'

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
 *  - Agent system-prompt cache (`warmupAgentPrompt`): SHACL read +
 *    `buildSystemPrompt` + `extractVocabulary`. Tens of seconds on a cold
 *    start; benefits every provider. Without this, the warmup step that
 *    "builds the system prompt" did so into a local variable that was
 *    discarded — the agent's own cache only filled on first user request.
 *  - Copilot SDK session: ~6s session-create cost. Only relevant for the
 *    Copilot provider.
 */
export async function warmupLlmSession(): Promise<void> {
  const config = getConfig()
  await warmupAgentPrompt()
  if (config.AI_PROVIDER === 'copilot') {
    await getPersistentSession()
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
