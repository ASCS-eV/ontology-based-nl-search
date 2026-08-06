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
import { generateText, hasToolCall, isStepCount, type LanguageModel, streamText } from 'ai'

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
  SUBMIT_TOOL_NAME,
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
  streaming?: boolean
  providerOptions?: Parameters<typeof generateText>[0]['providerOptions']
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
  // Forward only the two production options by name. Spreading the caller's
  // object would let any extra key structurally satisfy InjectedAgentOptions
  // and override the policy — the very thing the "LLM never writes SPARQL"
  // invariant depends on not being reachable from a request path.
  const run = await executeAgentRun(naturalLanguageQuery, getModel(), {
    ...(options?.domain === undefined ? {} : { domain: options.domain }),
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  })
  return buildValidatedResponse(run)
}

/**
 * Internal evaluation seam. It accepts a caller-owned model but otherwise
 * executes the exact production path, additionally collecting the trace the
 * scorer needs. Only the private `./evaluation` package entrypoint exposes
 * this function outside this package.
 */
export async function runSparqlAgentWithModel(
  naturalLanguageQuery: string,
  model: LanguageModel,
  options?: InjectedAgentOptions
): Promise<AgentEvaluationResult> {
  const run = await executeAgentRun(naturalLanguageQuery, model, options)
  const toolCalls = collectToolTraces(run.result)
  const rawSubmission = extractRawSubmission(toolCalls)
  const validatedResponse = await buildValidatedResponse(run)

  const trace: AgentEvaluationTrace = {
    finishReason: String(run.result.finishReason ?? 'unknown'),
    usage: normalizeUsage(run.result.usage),
    toolCalls,
    rawSubmission,
    promptChars: run.prompt.length,
    retrieval: summarizeRetrieval(run.retrieved),
    missingSubmitFallback: run.submitCall === undefined,
  }
  await options?.observer?.(trace)

  return { rawSubmission, validatedResponse, trace }
}

interface AgentRun {
  result: GenerateResultLike
  prompt: string
  retrieved: Awaited<ReturnType<typeof buildRequestPrompt>>['retrieved']
  vocabulary: Awaited<ReturnType<typeof getAgentContext>>['vocabulary']
  submitCall: ToolResultLike | undefined
  targetDomain: string
  naturalLanguageQuery: string
  sw: Stopwatch
}

/**
 * The shared agent round-trip. Both entrypoints run exactly this; they differ
 * only in what they derive afterwards, so production never pays to build
 * evaluation traces it would immediately discard.
 */
async function executeAgentRun(
  naturalLanguageQuery: string,
  model: LanguageModel,
  options?: InjectedAgentOptions
): Promise<AgentRun> {
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
  const providerOptions = {
    ...options?.providerOptions,
    ...(policy.thinking
      ? {
          anthropic: {
            thinking:
              policy.thinking.mode === 'adaptive'
                ? { type: 'adaptive' as const }
                : { type: 'enabled' as const, budgetTokens: policy.thinking.budgetTokens },
          },
        }
      : {}),
  }

  const generationOptions = {
    model,
    instructions: prompt,
    prompt: naturalLanguageQuery,
    tools: { ...lookupTools, ...agentTools },
    // Every step must be a tool call — a bounded lookup or the single
    // submission tool; prose-only turns are impossible. The step budget
    // caps lookups, and a budget spent without submit_slots degrades to
    // the deterministic fallback below.
    toolChoice: 'required' as const,
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
    ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
  }
  const result = options?.streaming
    ? await collectStreamingResult(streamText(generationOptions))
    : await generateText(generationOptions)
  endLlmCall()

  // Extract the validated submit_slots call from tool results. Tool outputs
  // have passed the SDK's schema and execute handler; the raw arguments are
  // read separately by the evaluation seam so it can distinguish protocol
  // failures from semantic ones.
  const submitCall = result.steps
    .flatMap((step) => step.toolResults ?? [])
    .find((toolResult) => toolResult?.toolName === SUBMIT_TOOL_NAME)
  if (!submitCall) diagnoseMissingSubmit(result)

  return {
    result,
    prompt,
    retrieved,
    vocabulary,
    submitCall,
    targetDomain,
    naturalLanguageQuery,
    sw,
  }
}

/** Turn a completed agent round-trip into the response the API returns. */
async function buildValidatedResponse(run: AgentRun): Promise<LlmStructuredResponse> {
  if (run.submitCall) {
    const answer = run.submitCall.output as SlotSubmissionParams
    const response = await runSlotPipeline({
      submission: answer,
      vocabulary: run.vocabulary,
      targetDomain: run.targetDomain,
      sw: run.sw,
      query: run.naturalLanguageQuery,
    })
    return { ...response, timings: run.sw.getTimings() }
  }
  // Fallback: LLM didn't call submit_slots — shared with the Copilot
  // adapter so the cross-domain query and vocabulary hint stay identical.
  const fallback = await buildEmptyFallbackResponse(run.naturalLanguageQuery, run.vocabulary)
  return { ...fallback, timings: run.sw.getTimings() }
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
  finishReason: unknown
  usage?: unknown
  steps: ReadonlyArray<{
    toolCalls?: ReadonlyArray<ToolCallLike>
    toolResults?: ReadonlyArray<ToolResultLike>
  }>
}

interface StreamingResultLike {
  finishReason: PromiseLike<unknown>
  usage: PromiseLike<unknown>
  text: PromiseLike<string>
  steps: PromiseLike<GenerateResultLike['steps']>
}

async function collectStreamingResult(
  result: StreamingResultLike
): Promise<GenerateResultLike & { text: string }> {
  const [finishReason, usage, text, steps] = await Promise.all([
    result.finishReason,
    result.usage,
    result.text,
    result.steps,
  ])
  return { finishReason, usage, text, steps }
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
  const raw = toolCalls.find((call) => call.toolName === SUBMIT_TOOL_NAME)?.input
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
