/**
 * Private model-evaluation entrypoint.
 *
 * This subpath is intentionally separate from the HTTP-facing package facade:
 * callers can inject an OpenAI-compatible `LanguageModel`, while production
 * continues to resolve its provider through `getModel()`.
 */
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

import type { AgentPolicy } from './agent/agent-policy.js'
import { type AgentOptions, runSparqlAgentWithModel } from './agent/index.js'
import { SCHEMA_TOOL_NAMES } from './agent/schema-tools.js'

export type {
  AgentEvaluationObserver,
  AgentEvaluationResult,
  AgentEvaluationTrace,
  EvaluationRetrievalTrace,
  EvaluationToolTrace,
} from './agent/evaluation-types.js'

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
    maxSteps: 3,
    thinking: null,
    reasoningEffort: null,
    forcedTool: 'submit_slots',
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

export function evaluateStructuredSearch(query: string, options: EvaluateSearchOptions) {
  const modelId = typeof options.model === 'string' ? options.model : options.model.modelId
  return runSparqlAgentWithModel(query, options.model, {
    domain: options.domain,
    signal: options.signal,
    observer: options.observer,
    policy: options.policy ?? createEvaluationPolicy(modelId),
  })
}
