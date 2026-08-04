/**
 * Private model-evaluation entrypoint.
 *
 * This subpath is intentionally separate from the HTTP-facing package facade:
 * callers can inject an OpenAI-compatible `LanguageModel`, while production
 * continues to resolve its provider through `getModel()`.
 */
import { createOpenAI } from '@ai-sdk/openai'
import type { generateText, LanguageModel } from 'ai'

import type { AgentPolicy } from './agent/agent-policy.js'
import { type AgentOptions, runSparqlAgentWithModel } from './agent/index.js'
import { SCHEMA_TOOL_NAMES } from './agent/schema-tools.js'
import { SUBMIT_TOOL_NAME } from './agent/tools.js'

/**
 * Agent steps allowed in an evaluation run: up to two bounded lookups plus the
 * submission. The harness reads this rather than restating `3`, so a change to
 * the evaluated policy cannot silently diverge from what the scorer enforces.
 */
export const EVALUATION_MAX_AGENT_STEPS = 3

export type {
  AgentEvaluationObserver,
  AgentEvaluationResult,
  AgentEvaluationTrace,
  EvaluationRetrievalTrace,
  EvaluationToolTrace,
} from './agent/evaluation-types.js'

/**
 * The agent's own tool registry, re-exported so the harness classifies tool
 * traces against what the agent actually registers rather than a hand-kept
 * copy that can drift out of step with it.
 */
export { SCHEMA_TOOL_NAMES } from './agent/schema-tools.js'
export { AGENT_TOOL_NAMES, SUBMIT_TOOL_NAME } from './agent/tools.js'

/**
 * The exact schema `submit_slots` validates against. Exposed so the harness
 * can assert it never scores against a stricter contract than the one
 * production accepts.
 */
export { slotSubmissionSchema } from './agent/tools.js'

export interface OpenAICompatibleModelOptions {
  baseUrl: string
  model: string
  apiKey?: string
  headers?: Record<string, string>
}

export interface EvaluateSearchOptions extends AgentOptions {
  model: LanguageModel
  observer?: import('./agent/evaluation-types.js').AgentEvaluationObserver
  policy?: AgentPolicy
  /** Use the provider's streaming transport while preserving the same agent loop. */
  streaming?: boolean
  /** Evaluation-only provider controls such as Responses API storage policy. */
  providerOptions?: Parameters<typeof generateText>[0]['providerOptions']
}

export type { AgentPolicy as EvaluationAgentPolicy } from './agent/agent-policy.js'

export function createEvaluationPolicy(
  model: string,
  retrieval: AgentPolicy['retrieval'] = {
    maxDomains: 3,
    maxCards: 40,
    maxContextChars: 45_000,
  }
): AgentPolicy {
  return {
    temperature: 0,
    maxSteps: EVALUATION_MAX_AGENT_STEPS,
    thinking: null,
    reasoningEffort: null,
    forcedTool: SUBMIT_TOOL_NAME,
    lookupTools: SCHEMA_TOOL_NAMES,
    model,
    provider: 'openai-compatible',
    retrieval,
  }
}

/**
 * Construct a model for a local OpenAI-compatible server without mutating
 * process environment. `.chat()` deliberately selects `/chat/completions`,
 * the common denominator across llama.cpp, vLLM, SGLang, and Ollama proxies.
 */
export function createOpenAICompatibleModel(options: OpenAICompatibleModelOptions): LanguageModel {
  const provider = createOpenAI({
    baseURL: options.baseUrl.replace(/\/+$/, ''),
    apiKey: options.apiKey ?? 'local-evaluation',
    ...(options.headers ? { headers: options.headers } : {}),
  })
  return provider.chat(options.model)
}

/**
 * Construct a Responses-wire model for hosted smoke tests. Local runtimes use
 * the chat-completions factory above; Codex and the public OpenAI API use the
 * Responses protocol instead. Authentication remains caller-owned so this
 * private seam never reads credentials or mutates process environment.
 */
export function createOpenAIResponsesModel(options: OpenAICompatibleModelOptions): LanguageModel {
  const provider = createOpenAI({
    baseURL: options.baseUrl.replace(/\/+$/, ''),
    apiKey: options.apiKey ?? 'hosted-evaluation',
    ...(options.headers ? { headers: options.headers } : {}),
  })
  return provider.responses(options.model)
}

export function evaluateStructuredSearch(query: string, options: EvaluateSearchOptions) {
  const modelId = typeof options.model === 'string' ? options.model : options.model.modelId
  return runSparqlAgentWithModel(query, options.model, {
    domain: options.domain,
    signal: options.signal,
    observer: options.observer,
    policy: options.policy ?? createEvaluationPolicy(modelId),
    streaming: options.streaming,
    providerOptions: options.providerOptions,
  })
}
