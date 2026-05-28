import { getConfig } from '@ontology-search/core/config'
import { Stopwatch } from '@ontology-search/core/logging'
import { getPrimaryDomain } from '@ontology-search/ontology/domain-registry'
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
import { createInvestigationTools } from './investigation-tools.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import { agentTools, type SlotSubmissionParams } from './tools.js'

/** Cached system prompt and vocabulary */
let cachedSystemPrompt: string | null = null
let cachedVocabulary: OntologyVocabulary | null = null
let cachedStore: import('@ontology-search/sparql/types').SparqlStore | null = null

/**
 * Build system prompt from live ontology vocabulary.
 * Cached after first build — the ontology doesn't change at runtime.
 */
async function getSystemPrompt(): Promise<{
  prompt: string
  vocabulary: OntologyVocabulary
  store: import('@ontology-search/sparql/types').SparqlStore
}> {
  if (cachedSystemPrompt && cachedVocabulary && cachedStore) {
    return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary, store: cachedStore }
  }

  // Read raw SHACL files for the system prompt (LLM reads native Turtle)
  const shaclContent = getShaclContent()
  cachedSystemPrompt = buildSystemPrompt(shaclContent)

  // Extract vocabulary separately — still needed for post-LLM slot validation
  const store = await getInitializedStore()
  cachedVocabulary = await extractVocabulary(store)
  cachedStore = store
  return { prompt: cachedSystemPrompt, vocabulary: cachedVocabulary, store }
}

/**
 * Pre-populate the agent's system-prompt cache during startup warmup so the
 * first user query doesn't pay the SHACL-read + buildSystemPrompt +
 * extractVocabulary cost (tens of seconds on a cold start; observed as
 * `prompt-build` spending >10s while the cache stood empty).
 *
 * `getSystemPrompt` already memoises into module-private singletons; this
 * helper just triggers that build during warmup so the warm-cache value is
 * what the first request sees. No-op when the cache is already populated.
 */
export async function warmupAgentPrompt(): Promise<void> {
  await getSystemPrompt()
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
  const targetDomain = options?.domain ?? (await getPrimaryDomain())

  const endPrompt = sw.time('prompt-build')
  const { prompt, vocabulary, store } = await getSystemPrompt()
  const model = getModel()
  const investigationTools = createInvestigationTools(store)
  endPrompt()

  const endLlmCall = sw.time('llm-round-trip')
  // Investigation tools allow the LLM to explore the schema if needed.
  // Typical path: LLM reads SHACL in prompt → directly calls submit_slots (1 step).
  // Complex queries: LLM calls discover_* tools first → then submit_slots (2-3 steps).
  const result = await generateText({
    model,
    system: prompt,
    prompt: naturalLanguageQuery,
    tools: { ...agentTools, ...investigationTools },
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

  // Fallback: LLM didn't call submit_slots — emit the broadest possible
  // query (cross-domain VALUES over every discovered asset class) so the
  // caller sees results from every domain rather than from whichever
  // domain happened to sort first alphabetically. The previous fallback
  // used `getPrimaryDomain()` as a default, which silently anchored
  // empty queries to a single arbitrary domain — e.g. routing a
  // German "gibt es karten…" query into the `automotive-simulator`
  // domain just because it sorts before `hdmap`.
  const fallbackSlots: SearchSlots = { domains: [], filters: {}, ranges: {} }
  const sparql = await compileSlots(fallbackSlots)
  return {
    interpretation: {
      summary: 'Searching across all asset domains (LLM did not extract specific filters)',
      mappedTerms: [],
    },
    gaps: [
      {
        term: naturalLanguageQuery,
        reason:
          'Could not extract structured filters from the query. Try rephrasing with concrete property names from the ontology (e.g. roadTypes, scenarioCategory), or filter by country / license / asset type directly.',
      },
    ],
    sparql,
    timings: sw.getTimings(),
  }
}
