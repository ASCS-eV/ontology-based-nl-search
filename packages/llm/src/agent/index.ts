import { extractVocabulary, getInitializedStore } from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'
import { generateText, stepCountIs } from 'ai'

import { buildSystemPrompt } from '../prompt-builder.js'
import { getModel } from '../provider.js'
import type { LlmStructuredResponse } from '../types.js'
import { agentTools, type SlotSubmissionParams } from './tools.js'

/**
 * Maximum tool-calling steps. With slot-filling, the agent typically
 * needs only 1 step: submit_slots. Allow 3 for retries.
 */
const MAX_STEPS = 3

/** Cached system prompt (built from ontology vocabulary at startup) */
let cachedSystemPrompt: string | null = null

/**
 * Build system prompt from live ontology vocabulary.
 * Cached after first build — the ontology doesn't change at runtime.
 */
async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt

  const store = await getInitializedStore()
  const vocabulary = await extractVocabulary(store)
  cachedSystemPrompt = buildSystemPrompt(vocabulary)
  return cachedSystemPrompt
}

export interface AgentOptions {
  domain?: string
}

/**
 * Run the slot-filling agent via Vercel AI SDK.
 *
 * The LLM receives the full ontology vocabulary in its system prompt
 * (auto-generated from SHACL shapes) and directly fills search slots.
 * No pre-processing or SKOS matching — the LLM IS the synonym resolver.
 */
export async function runSparqlAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const targetDomain = options?.domain ?? 'hdmap'
  const systemPrompt = await getSystemPrompt()
  const model = getModel()

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: naturalLanguageQuery,
    tools: agentTools,
    toolChoice: 'required',
    stopWhen: stepCountIs(MAX_STEPS),
  })

  // Extract the submit_slots call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  if (submitCall) {
    const answer = submitCall.output as SlotSubmissionParams

    const slots: SearchSlots = {
      domains: answer.slots.domains ?? [targetDomain],
      filters: answer.slots.filters ?? {},
      ranges: answer.slots.ranges ?? {},
      location: answer.slots.location,
      license: answer.slots.license,
    }
    const sparql = await compileSlots(slots)

    return {
      interpretation: answer.interpretation,
      gaps: answer.gaps,
      sparql,
    }
  }

  // Fallback: LLM didn't call the tool — return broad search
  const fallbackSlots: SearchSlots = { domains: [targetDomain], filters: {}, ranges: {} }
  const sparql = await compileSlots(fallbackSlots)
  return {
    interpretation: {
      summary: `Searching all ${targetDomain} datasets (LLM did not extract specific filters)`,
      mappedTerms: [],
    },
    gaps: [
      {
        term: naturalLanguageQuery,
        reason: 'Could not extract structured filters from the query',
      },
    ],
    sparql,
  }
}
