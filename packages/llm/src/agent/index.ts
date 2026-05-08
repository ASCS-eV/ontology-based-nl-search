import {
  extractVocabulary,
  getInitializedStore,
  type OntologyVocabulary,
} from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'
import { generateText, stepCountIs } from 'ai'

import { buildSystemPrompt } from '../prompt-builder.js'
import { getModel } from '../provider.js'
import { correctFilters, validateSlots } from '../slot-validator.js'
import type { LlmStructuredResponse } from '../types.js'
import { agentTools, type SlotSubmissionParams } from './tools.js'

/**
 * Maximum tool-calling steps. With slot-filling, the agent typically
 * needs only 1 step: submit_slots. Allow 3 for retries.
 */
const MAX_STEPS = 3

/** Cached system prompt and vocabulary */
let cachedSystemPrompt: string | null = null
let cachedVocabulary: OntologyVocabulary | null = null

/**
 * Build system prompt from live ontology vocabulary.
 * Cached after first build — the ontology doesn't change at runtime.
 */
async function getSystemPrompt(): Promise<{ prompt: string; vocabulary: OntologyVocabulary }> {
  if (cachedSystemPrompt && cachedVocabulary) {
    return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary }
  }

  const store = await getInitializedStore()
  cachedVocabulary = await extractVocabulary(store)
  cachedSystemPrompt = buildSystemPrompt(cachedVocabulary)
  return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary }
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
 *
 * Post-LLM validation layer corrects filter values and recomputes confidence.
 */
export async function runSparqlAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const targetDomain = options?.domain ?? 'hdmap'
  const { prompt, vocabulary } = await getSystemPrompt()
  const model = getModel()

  const result = await generateText({
    model,
    system: prompt,
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

    // Correct filter values against vocabulary before compiling
    const correctedFilters = correctFilters(answer.slots.filters ?? {}, vocabulary)

    const slots: SearchSlots = {
      domains: answer.slots.domains ?? [targetDomain],
      filters: correctedFilters,
      ranges: answer.slots.ranges ?? {},
      location: answer.slots.location,
      license: answer.slots.license,
    }
    const sparql = await compileSlots(slots)

    // Build raw response, then validate interpretation + gaps
    const rawResponse: LlmStructuredResponse = {
      interpretation: answer.interpretation,
      gaps: answer.gaps,
      sparql,
    }

    return validateSlots(rawResponse, vocabulary)
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
