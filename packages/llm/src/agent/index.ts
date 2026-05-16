import { Stopwatch } from '@ontology-search/core/logging'
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
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
import {
  correctDomains,
  correctFilters,
  validateRangesAgainstShacl,
  validateSlots,
  validateSlotsAgainstShacl,
} from '../slot-validator.js'
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
  const result = await generateText({
    model,
    system: prompt,
    prompt: naturalLanguageQuery,
    tools: agentTools,
    toolChoice: 'required',
    stopWhen: stepCountIs(MAX_STEPS),
    abortSignal: options?.signal,
  })
  endLlmCall()

  // Extract the submit_slots call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  if (submitCall) {
    const answer = submitCall.output as SlotSubmissionParams

    const endValidation = sw.time('post-llm-validation')
    // 1. Fuzzy match: case / typo correction against sh:in enums.
    const fuzzedFilters = correctFilters(answer.slots.filters ?? {}, vocabulary)
    // 2. SHACL gate: enforces every Core constraint declared in the shapes
    // graph (sh:pattern, sh:datatype, …) on filters, location, and license.
    // Values that fail are dropped from slots and emitted as gaps.
    const shacl = await ShaclValidator.fromWorkspace()
    const shaclResult = await validateSlotsAgainstShacl(
      fuzzedFilters,
      answer.slots.location,
      answer.slots.license,
      shacl,
      vocabulary
    )
    // Ranges go through their own check: numeric values always pass SHACL
    // datatype constraints, so we only need to confirm the property name
    // is known. Hallucinated keys (e.g. `numberLanes`) are dropped here.
    const rangeResult = validateRangesAgainstShacl(answer.slots.ranges ?? {}, shacl)
    const correctedDomains = correctDomains(
      answer.slots.domains ?? [targetDomain],
      shaclResult.filters,
      rangeResult.ranges,
      vocabulary
    )
    endValidation()

    const slots: SearchSlots = {
      domains: correctedDomains,
      filters: shaclResult.filters,
      ranges: rangeResult.ranges,
      location: shaclResult.location,
      license: shaclResult.license,
    }

    const endCompile = sw.time('sparql-compile')
    const sparql = await compileSlots(slots)
    endCompile()

    const rawResponse: LlmStructuredResponse = {
      interpretation: answer.interpretation,
      gaps: [...answer.gaps, ...shaclResult.gaps, ...rangeResult.gaps],
      sparql,
    }

    const validated = validateSlots(rawResponse, vocabulary)
    return { ...validated, timings: sw.getTimings() }
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
