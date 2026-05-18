import { getConfig } from '@ontology-search/core/config'
import { Stopwatch } from '@ontology-search/core/logging'
import {
  extractVocabulary,
  getInitializedStore,
  type OntologyVocabulary,
} from '@ontology-search/search'
import { compileSlots } from '@ontology-search/search/compiler'
import { getShaclContent } from '@ontology-search/search/shacl-reader'
import type { SearchSlots } from '@ontology-search/search/slots'
import { generateText, stepCountIs } from 'ai'

import { buildSystemPrompt } from '../prompt-builder.js'
import { getModel } from '../provider.js'
import type { LlmStructuredResponse } from '../types.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import { agentTools, type SlotSubmissionParams } from './tools.js'

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

  // Read raw SHACL files for the system prompt (LLM reads native Turtle)
  const shaclContent = getShaclContent()
  cachedSystemPrompt = buildSystemPrompt(shaclContent)

  // Extract vocabulary separately — still needed for post-LLM slot validation
  const store = await getInitializedStore()
  cachedVocabulary = await extractVocabulary(store)
  return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary }
}

export interface AgentOptions {
  domain?: string
  /** Cancel the LLM round-trip when the caller aborts. */
  signal?: AbortSignal
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
  const sw = new Stopwatch()
  const targetDomain = options?.domain ?? 'hdmap'

  const endPrompt = sw.time('prompt-build')
  const { prompt, vocabulary } = await getSystemPrompt()
  const model = getModel()
  endPrompt()

  const endLlmCall = sw.time('llm-round-trip')
  // With slot-filling, the agent typically needs only 1 step: submit_slots.
  // LLM_MAX_AGENT_STEPS (default 3) leaves headroom for retries.
  const result = await generateText({
    model,
    system: prompt,
    prompt: naturalLanguageQuery,
    tools: agentTools,
    toolChoice: 'required',
    stopWhen: stepCountIs(getConfig().LLM_MAX_AGENT_STEPS),
    abortSignal: options?.signal,
  })
  endLlmCall()

  // Extract the submit_slots call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  if (submitCall) {
    const answer = submitCall.output as SlotSubmissionParams
    const response = await runSlotPipeline({
      submission: answer,
      vocabulary,
      targetDomain,
      sw,
    })
    return { ...response, timings: sw.getTimings() }
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
    timings: sw.getTimings(),
  }
}
