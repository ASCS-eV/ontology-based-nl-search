/**
 * Vercel AI SDK Adapter — slot-filling via `generateText` + forced tool choice.
 *
 * Handles all non-Copilot providers: openai, ollama, anthropic, claude-cli, vibe-cli.
 * Reads the shared AgentPolicy for temperature, thinking budget, tool choice,
 * and max steps — no local policy decisions.
 *
 * @see ./agent-policy.ts — Single source of truth for agent behaviour
 * @see ./agent-context.ts — Shared prompt/vocabulary/store caching
 */

import { createComponentLogger, Stopwatch } from '@ontology-search/core/logging'
import { getPrimaryDomain } from '@ontology-search/search'
import { generateText, hasToolCall, stepCountIs } from 'ai'

import { getModel } from '../provider.js'
import type { LlmStructuredResponse } from '../types.js'
import { buildRequestPrompt, getAgentContext, warmupAgentContext } from './agent-context.js'
import { getAgentPolicy } from './agent-policy.js'
import { buildEmptyFallbackResponse } from './empty-fallback.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import { agentTools, lookupTools, type SlotSubmissionParams } from './tools.js'

/**
 * Pre-populate the agent's system-prompt cache during startup warmup so the
 * first user query doesn't pay the cold-start cost.
 */
export async function warmupAgentPrompt(): Promise<void> {
  await warmupAgentContext()
}

export interface AgentOptions {
  domain?: string
  /** Cancel the LLM round-trip when the caller aborts. */
  signal?: AbortSignal
}

/**
 * Run the slot-filling agent via Vercel AI SDK.
 *
 * The LLM receives the static instruction core plus the SHACL fragments
 * retrieved for this query in its system prompt and directly fills search
 * slots. No pre-processing or SKOS matching — the LLM IS the synonym
 * resolver.
 *
 * Post-LLM validation layer corrects filter values and recomputes confidence.
 */
export async function runSparqlAgent(
  naturalLanguageQuery: string,
  options?: AgentOptions
): Promise<LlmStructuredResponse> {
  const sw = new Stopwatch()
  const policy = getAgentPolicy()
  const targetDomain = options?.domain ?? (await getPrimaryDomain())

  const endSetup = sw.time('setup')
  const { vocabulary } = await getAgentContext()
  const model = getModel()
  endSetup()

  // Per-query system prompt: static core + the schema context retrieved
  // for this query. Same seam the Copilot adapter uses.
  const endRetrieval = sw.time('retrieval')
  const { prompt } = await buildRequestPrompt(naturalLanguageQuery, {
    signal: options?.signal,
    maxDomains: policy.retrieval.maxDomains,
    maxCards: policy.retrieval.maxCards,
    maxContextChars: policy.retrieval.maxContextChars,
  })
  endRetrieval()

  const endLlmCall = sw.time('llm-round-trip')
  // Anthropic extended thinking — translated from the shared policy.
  const providerOptions = policy.thinking
    ? {
        anthropic: {
          thinking: { type: 'enabled' as const, budgetTokens: policy.thinking.budgetTokens },
        },
      }
    : undefined

  const result = await generateText({
    model,
    system: prompt,
    prompt: naturalLanguageQuery,
    tools: { ...lookupTools, ...agentTools },
    // Every step must be a tool call — a bounded lookup or the single
    // submission tool; prose-only turns are impossible. The step budget
    // caps lookups, and a budget spent without submit_slots degrades to
    // the deterministic fallback below.
    toolChoice: 'required',
    // Stop the moment the submission arrives OR when the lookup budget is
    // spent — 'required' alone would force tool calls until the step cap
    // on every request, even after a successful submit.
    stopWhen: [stepCountIs(policy.maxSteps), hasToolCall(policy.forcedTool)],
    abortSignal: options?.signal,
    temperature: policy.temperature,
    ...(providerOptions ? { providerOptions } : {}),
  })
  endLlmCall()

  // Extract the submit_slots call from tool results
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  if (!submitCall) {
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

  // Fallback: LLM didn't call submit_slots — shared with the Copilot
  // adapter so the cross-domain query and vocabulary hint stay identical.
  const fallback = await buildEmptyFallbackResponse(naturalLanguageQuery, vocabulary)
  return { ...fallback, timings: sw.getTimings() }
}

const diagnosticLog = createComponentLogger('agent-diagnostics')

/**
 * Surface why `submit_slots` wasn't called. Three patterns recur:
 *   1. Model emitted prose instead of any tool call.
 *   2. Model called the wrong tool and was cut off by maxSteps.
 *   3. Model called the right tool with a malformed payload that Zod rejected.
 */
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
