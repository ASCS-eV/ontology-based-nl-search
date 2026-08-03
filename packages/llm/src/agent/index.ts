/**
 * Vercel AI SDK Adapter — slot-filling via `generateText` + forced tool choice.
 *
 * Handles all non-Copilot providers: openai, ollama, anthropic, claude-cli, vibe-cli.
 * Reads the shared AgentPolicy for temperature, reasoning mode, tool choice,
 * and max steps — no local policy decisions.
 *
 * @see ./agent-policy.ts — Single source of truth for agent behaviour
 * @see ./agent-context.ts — Shared prompt/vocabulary/store caching
 */

import { createComponentLogger, Stopwatch } from '@ontology-search/core/logging'
import { getPrimaryDomain } from '@ontology-search/search'
import { generateText, hasToolCall, isStepCount, type LanguageModel } from 'ai'

import { getModel } from '../provider.js'
import type { LlmStructuredResponse } from '../types.js'
import { buildRequestPrompt, getAgentContext, warmupAgentContext } from './agent-context.js'
import { type AgentPolicy, getAgentPolicy } from './agent-policy.js'
import { buildEmptyFallbackResponse } from './empty-fallback.js'
import {
  type AgentEvaluationObserver,
  type AgentEvaluationResult,
  type AgentEvaluationTrace,
  type EvaluationToolTrace,
  summarizeRetrieval,
} from './evaluation-types.js'
import type { SlotPipelineSubmission } from './run-slot-pipeline.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import {
  agentTools,
  lookupTools,
  type SlotSubmissionParams,
  slotSubmissionSchema,
} from './tools.js'

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

interface InjectedAgentOptions extends AgentOptions {
  observer?: AgentEvaluationObserver
  policy?: AgentPolicy
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
  const result = await runSparqlAgentWithModel(naturalLanguageQuery, getModel(), options)
  return result.validatedResponse
}

/**
 * Internal evaluation seam. It accepts a caller-owned model but otherwise
 * executes the exact production path. Only the private `./evaluation`
 * package entrypoint exposes this function outside this package.
 */
export async function runSparqlAgentWithModel(
  naturalLanguageQuery: string,
  model: LanguageModel,
  options?: InjectedAgentOptions
): Promise<AgentEvaluationResult> {
  const sw = new Stopwatch()
  const policy = options?.policy ?? getAgentPolicy()
  const targetDomain = options?.domain ?? (await getPrimaryDomain())

  const endSetup = sw.time('setup')
  const { vocabulary } = await getAgentContext()
  endSetup()

  // Per-query system prompt: static core + the schema context retrieved
  // for this query. Same seam the Copilot adapter uses.
  const endRetrieval = sw.time('retrieval')
  const { prompt, retrieved } = await buildRequestPrompt(naturalLanguageQuery, {
    signal: options?.signal,
    maxDomains: policy.retrieval.maxDomains,
    maxCards: policy.retrieval.maxCards,
    maxContextChars: policy.retrieval.maxContextChars,
  })
  endRetrieval()

  const endLlmCall = sw.time('llm-round-trip')
  // Anthropic reasoning — translated from the shared policy. `adaptive` and a
  // fixed budget are different request shapes, and each is a 400 on the other's
  // model generation, so the policy's mode decides rather than a default.
  const providerOptions = policy.thinking
    ? {
        anthropic: {
          thinking:
            policy.thinking.mode === 'adaptive'
              ? { type: 'adaptive' as const }
              : { type: 'enabled' as const, budgetTokens: policy.thinking.budgetTokens },
        },
      }
    : undefined

  const result = await generateText({
    model,
    instructions: prompt,
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
    stopWhen: [isStepCount(policy.maxSteps), hasToolCall(policy.forcedTool)],
    abortSignal: options?.signal,
    // Spread, never `temperature: policy.temperature` — an explicit
    // `undefined` is still a present key that the Anthropic provider
    // serializes, and models from the Claude 4.7 generation on reject the
    // parameter outright [ANTHROPIC-MSG] `/v1/messages` § Request.
    ...(policy.temperature !== undefined ? { temperature: policy.temperature } : {}),
    ...(providerOptions ? { providerOptions } : {}),
  })
  endLlmCall()

  const toolCalls = collectToolTraces(result)
  const rawSubmission = extractRawSubmission(toolCalls)

  // Extract the validated submit_slots call from tool results. Tool outputs
  // have passed the SDK's schema and execute handler; raw arguments are kept
  // separately above so evaluation can distinguish protocol from semantics.
  const submitCall = result.steps
    .flatMap((step) => step.toolResults)
    .find((r) => r.toolName === 'submit_slots')

  let validatedResponse: LlmStructuredResponse
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
    validatedResponse = { ...response, timings: sw.getTimings() }
  } else {
    // Fallback: LLM didn't call submit_slots — shared with the Copilot
    // adapter so the cross-domain query and vocabulary hint stay identical.
    const fallback = await buildEmptyFallbackResponse(naturalLanguageQuery, vocabulary)
    validatedResponse = { ...fallback, timings: sw.getTimings() }
  }

  const trace: AgentEvaluationTrace = {
    finishReason: String(result.finishReason ?? 'unknown'),
    usage: normalizeUsage(result.usage),
    toolCalls,
    rawSubmission,
    promptChars: prompt.length,
    retrieval: summarizeRetrieval(retrieved),
    missingSubmitFallback: !submitCall,
  }
  await options?.observer?.(trace)

  return { rawSubmission, validatedResponse, trace }
}

interface ToolResultLike {
  toolName: string
  toolCallId?: string
  output?: unknown
}

interface ToolCallLike {
  toolName: string
  toolCallId?: string
  input?: unknown
}

interface GenerateResultLike {
  finishReason?: unknown
  usage?: unknown
  steps: ReadonlyArray<{
    toolCalls?: ReadonlyArray<ToolCallLike>
    toolResults?: ReadonlyArray<ToolResultLike>
  }>
}

function collectToolTraces(result: GenerateResultLike): EvaluationToolTrace[] {
  const traces: EvaluationToolTrace[] = []
  for (const [step, value] of result.steps.entries()) {
    const results = new Map(
      (value.toolResults ?? []).map((toolResult) => [
        toolResult.toolCallId ?? `${toolResult.toolName}:${step}`,
        toolResult,
      ])
    )
    for (const call of value.toolCalls ?? []) {
      const resultKey = call.toolCallId ?? `${call.toolName}:${step}`
      traces.push({
        step,
        toolName: call.toolName,
        ...(call.toolCallId ? { callId: call.toolCallId } : {}),
        ...(call.input === undefined ? {} : { input: call.input }),
        ...(results.get(resultKey)?.output === undefined
          ? {}
          : { output: results.get(resultKey)?.output }),
      })
      results.delete(resultKey)
    }
    for (const result of results.values()) {
      traces.push({
        step,
        toolName: result.toolName,
        ...(result.toolCallId ? { callId: result.toolCallId } : {}),
        ...(result.output === undefined ? {} : { output: result.output }),
      })
    }
  }
  return traces
}

function extractRawSubmission(toolCalls: EvaluationToolTrace[]): SlotPipelineSubmission | null {
  const raw = toolCalls.find((call) => call.toolName === 'submit_slots')?.input
  const parsed = slotSubmissionSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function normalizeUsage(usage: unknown): AgentEvaluationTrace['usage'] {
  if (!usage || typeof usage !== 'object') return undefined
  const value = usage as Record<string, unknown>
  const number = (key: string): number | undefined =>
    typeof value[key] === 'number' ? value[key] : undefined
  const inputTokens = number('inputTokens')
  const outputTokens = number('outputTokens')
  const totalTokens = number('totalTokens')
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined
  }
  return { inputTokens, outputTokens, totalTokens }
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
