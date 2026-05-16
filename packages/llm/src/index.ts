import { getConfig } from '@ontology-search/core/config'

import { getPersistentSession, runCopilotAgent } from './agent/copilot-agent.js'
import { runSparqlAgent } from './agent/index.js'
import type { LlmStructuredResponse } from './types.js'

// Re-export the SHACL slot-validation helpers so the api app can use the
// same gate in its /refine composition root without depending on internal
// modules.
export type { ShaclSlotValidationResult } from './slot-validator.js'
export { validateRangesAgainstShacl, validateSlotsAgainstShacl } from './slot-validator.js'

export interface SearchOptions {
  domain?: string
}

/**
 * Pre-create the Copilot SDK session so the first user query doesn't
 * pay the ~6s session-create cost. No-op for non-copilot providers.
 */
export async function warmupLlmSession(): Promise<void> {
  const config = getConfig()
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
  const domain = options?.domain ?? 'hdmap'

  if (config.AI_PROVIDER === 'copilot') {
    return runCopilotAgent(naturalLanguageQuery, { domain })
  }

  return runSparqlAgent(naturalLanguageQuery, { domain })
}
