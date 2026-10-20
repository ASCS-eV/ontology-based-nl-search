import type { RetrievedSchema } from '@ontology-search/search'
import type { LlmStructuredResponse } from '@ontology-search/search/types'

import { composeRetrievedSections } from '../prompt/compose.js'
import type { SlotPipelineSubmission } from './run-slot-pipeline.js'

export interface EvaluationToolTrace {
  step: number
  toolName: string
  callId?: string
  input?: unknown
  output?: unknown
}

export interface EvaluationRetrievalTrace {
  domains: string[]
  confidence: number
  cardCount: number
  fragmentCount: number
  catalogCount: number
  contextChars: number
}

export interface AgentEvaluationTrace {
  finishReason: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  toolCalls: EvaluationToolTrace[]
  rawSubmission: SlotPipelineSubmission | null
  promptChars: number
  retrieval: EvaluationRetrievalTrace
  missingSubmitFallback: boolean
}

export interface AgentEvaluationResult {
  rawSubmission: SlotPipelineSubmission | null
  validatedResponse: LlmStructuredResponse
  trace: AgentEvaluationTrace
}

export type AgentEvaluationObserver = (trace: AgentEvaluationTrace) => void | Promise<void>

/**
 * Summarize what a retrieval costs the model.
 *
 * `contextChars` is measured by composing the prompt tail rather than by
 * re-adding up the parts. Any hand-rolled sum drifts the moment the
 * composer changes what it renders — and it over-counts structurally,
 * because the composer emits only the *routed* domains' detail and
 * subtracts whatever already appears as a card, while a parts-sum sees the
 * whole catalog. Composing is the only measure that cannot disagree with
 * the bytes the model receives.
 */
export function summarizeRetrieval(retrieved: RetrievedSchema): EvaluationRetrievalTrace {
  return {
    domains: [...retrieved.domains],
    confidence: retrieved.confidence,
    cardCount: retrieved.cards.length,
    fragmentCount: retrieved.fragments.length,
    catalogCount: retrieved.catalog.length,
    contextChars: composeRetrievedSections(retrieved).length,
  }
}
