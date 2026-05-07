import { runSparqlAgent } from './agent'
import { runCopilotAgent } from './agent/copilot-agent'
import type { LlmStructuredResponse } from './types'

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
  const provider = process.env.AI_PROVIDER || 'openai'
  const domain = options?.domain ?? 'hdmap'

  if (provider === 'copilot') {
    return runCopilotAgent(naturalLanguageQuery, { domain })
  }

  // Use the full agentic flow with Vercel AI SDK tool calling
  return runSparqlAgent(naturalLanguageQuery, { domain })
}

/**
 * Legacy function: Translate NL query directly to SPARQL.
 * Kept for backward compatibility with existing tests.
 */
export async function generateSparql(naturalLanguageQuery: string): Promise<string> {
  const response = await generateStructuredSearch(naturalLanguageQuery)
  return response.sparql
}
