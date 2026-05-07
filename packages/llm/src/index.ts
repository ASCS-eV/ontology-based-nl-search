import { getConfig } from '@ontology-search/core/config'

import { runCopilotAgent } from './agent/copilot-agent.js'
import { runSparqlAgent } from './agent/index.js'
import type { LlmStructuredResponse } from './types.js'

export interface SearchOptions {
  domain?: string
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
