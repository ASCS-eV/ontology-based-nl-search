import { getConfig } from '@ontology-search/core/config'
import { createComponentLogger, Stopwatch } from '@ontology-search/core/logging'
import { getPrimaryDomain } from '@ontology-search/ontology/domain-registry'
import {
  extractVocabulary,
  getInitializedStore,
  type OntologyVocabulary,
} from '@ontology-search/search'
import { getShaclContent } from '@ontology-search/search/shacl-reader'
import { generateText, stepCountIs } from 'ai'

import { buildSystemPrompt } from '../prompt-builder.js'
import { getModel } from '../provider.js'
import type { LlmStructuredResponse } from '../types.js'
import { buildEmptyFallbackResponse } from './empty-fallback.js'
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
  const config = getConfig()
  // Anthropic exposes an explicit chain-of-thought budget; every other
  // provider selects reasoning by model name (Mistral `magistral-*`,
  // OpenAI `o1` / `o4`). Skip the providerOptions entry when the budget
  // is zero or the provider can't use it — passing it would just be
  // dead weight in the request.
  const wantsThinking =
    config.LLM_THINKING_BUDGET > 0 &&
    (config.AI_PROVIDER === 'anthropic' || config.AI_PROVIDER === 'claude-cli')
  const providerOptions = wantsThinking
    ? {
        anthropic: {
          thinking: { type: 'enabled' as const, budgetTokens: config.LLM_THINKING_BUDGET },
        },
      }
    : undefined
  // Investigation tools allow the LLM to explore the schema if needed.
  // Typical path: LLM reads SHACL in prompt → directly calls submit_slots (1 step).
  // Complex queries: LLM calls discover_* tools first → then submit_slots (2-3 steps).
  const result = await generateText({
    model,
    system: prompt,
    prompt: naturalLanguageQuery,
    tools: { ...agentTools, ...investigationTools },
    // Force the LLM to invoke `submit_slots` instead of leaving tool
    // selection up to the model. With `'required'` (any tool), Haiku
    // consistently spent its step budget on `discover_*` exploration
    // and never reached `submit_slots` — the prompt already contains
    // the full SHACL, so investigation calls were redundant
    // overhead. Targeting `submit_slots` specifically means the LLM
    // commits immediately on step 1, restoring the contract that
    // every provider produces structured slots in one round-trip.
    toolChoice: { type: 'tool', toolName: 'submit_slots' },
    stopWhen: stepCountIs(config.LLM_MAX_AGENT_STEPS),
    abortSignal: options?.signal,
    // Slot filling is an EXTRACTION task, not a generative one.
    // Default to greedy decoding (temperature 0) so the same query
    // always yields the same slots. Configurable via `LLM_TEMPERATURE`
    // for the rare experiment where variance is wanted; honoured by
    // every Vercel-SDK provider.
    temperature: config.LLM_TEMPERATURE,
    ...(providerOptions ? { providerOptions } : {}),
  })
  endLlmCall()

  // Extract the submit_slots call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  if (!submitCall) {
    // Diagnostic: when no submit_slots call is found, dump enough of the
    // raw LLM response that an operator can tell whether the model
    // refused to call any tool (emitted prose), called a different tool,
    // or had no tool dispatch at all. Helps distinguish provider auth
    // issues (claude-cli OAuth tool-use restrictions) from model
    // behaviour problems (cold Mistral on first call) — both surface
    // here as "fallback fired".
    diagnoseMissingSubmit(result)
  }
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
  // cross-domain query plus a vocabulary-derived hint. Shared with the
  // Copilot agent so the message can't drift between providers.
  const fallback = await buildEmptyFallbackResponse(naturalLanguageQuery, vocabulary)
  return { ...fallback, timings: sw.getTimings() }
}

const diagnosticLog = createComponentLogger('agent-diagnostics')

/**
 * Surface why `submit_slots` wasn't called. Three patterns recur:
 *   1. Model emitted prose instead of any tool call — usually means
 *      the OAuth flow stripped `tools` from the request, or the model
 *      ignored the system prompt's "you MUST call submit_slots" rule.
 *   2. Model called only an investigation tool and then stopped —
 *      `LLM_MAX_AGENT_STEPS=1` cut it off mid-flow.
 *   3. Model called the right tool but with a malformed payload that
 *      Zod rejected silently — the call ends up in `toolCalls` but
 *      never in `toolResults`. The dispatched tool names alone can't
 *      distinguish this; we also log `finishReason` and a preview of
 *      `result.text`.
 *
 * Logs at INFO so the line is visible in dev without flipping
 * LOG_LEVEL. Truncates `text` to a short preview to keep noise low
 * even when the model emitted a long response.
 */
// Structural type avoids re-stating the generic-tool-shape result type;
// only fields the diagnostic actually reads are listed.
interface DiagnoseInput {
  finishReason: unknown
  text?: string
  steps: ReadonlyArray<{
    toolCalls?: ReadonlyArray<{ toolName: string }>
    toolResults?: ReadonlyArray<{ toolName: string }>
  }>
}
function diagnoseMissingSubmit(result: DiagnoseInput): void {
  const toolCallNames = result.steps.flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName))
  const toolResultNames = result.steps.flatMap((s) => (s.toolResults ?? []).map((r) => r.toolName))
  const textPreview = (result.text ?? '').slice(0, 400)
  diagnosticLog.info('No submit_slots tool call — fallback fired', {
    finishReason: result.finishReason,
    stepCount: result.steps.length,
    toolCallNames,
    toolResultNames,
    textPreview,
  })
}
