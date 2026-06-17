/**
 * Empty-slot fallback shared by every agent.
 *
 * Fires when the LLM does not call `submit_slots` (a provider auth quirk, a
 * cold model, or a payload Zod rejected). Emits the broadest cross-domain
 * query and a gap that nudges the user toward concrete property names — drawn
 * from the LIVE vocabulary so the hint never names a property absent from the
 * loaded ontology.
 *
 * Shared so the message cannot drift between the Vercel-SDK and Copilot agents.
 *
 * @see packages/llm/src/agent/index.ts — Vercel-SDK caller
 * @see packages/llm/src/agent/copilot-agent.ts — Copilot-SDK caller
 */
import type { OntologyVocabulary } from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'

import type { LlmStructuredResponse } from '../types.js'

/** How many example property names to surface in the fallback hint. */
const MAX_EXAMPLE_PROPERTIES = 3

export async function buildEmptyFallbackResponse(
  query: string,
  vocabulary: OntologyVocabulary
): Promise<LlmStructuredResponse> {
  const fallbackSlots: SearchSlots = { domains: [], filters: {}, ranges: {} }
  const sparql = await compileSlots(fallbackSlots)

  // Derive a couple of representative property local names from whatever
  // ontology is loaded. The `?? []` guards a partial vocabulary (e.g. a test
  // double) — a missing index just yields the generic, property-free hint.
  const exampleProperties = [
    ...(vocabulary.enumProperties ?? []).map((p) => p.localName),
    ...(vocabulary.numericProperties ?? []).map((p) => p.localName),
  ]
    .filter((name, i, all) => name.length > 0 && all.indexOf(name) === i)
    .slice(0, MAX_EXAMPLE_PROPERTIES)

  const hint =
    exampleProperties.length > 0
      ? `Try rephrasing with concrete property names from the ontology (e.g. ${exampleProperties.join(', ')}), or filter by asset type directly.`
      : 'Try rephrasing with concrete property names from the ontology, or filter by asset type directly.'

  return {
    interpretation: {
      summary: 'Searching across all asset domains (LLM did not extract specific filters)',
      mappedTerms: [],
    },
    gaps: [{ term: query, reason: `Could not extract structured filters from the query. ${hint}` }],
    sparql,
  }
}
