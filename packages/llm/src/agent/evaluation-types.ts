import type { RetrievedSchema } from '@ontology-search/search'
import type { LlmStructuredResponse } from '@ontology-search/search/types'

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

export function summarizeRetrieval(retrieved: RetrievedSchema): EvaluationRetrievalTrace {
  const contextChars =
    retrieved.fragments.reduce((sum, fragment) => sum + fragment.turtle.length, 0) +
    retrieved.catalog.reduce(
      (sum, domain) =>
        sum +
        domain.domain.length +
        domain.classLabels.join(' ').length +
        domain.sampleTerms.join(' ').length,
      0
    )

  return {
    domains: [...retrieved.domains],
    confidence: retrieved.confidence,
    cardCount: retrieved.cards.length,
    fragmentCount: retrieved.fragments.length,
    catalogCount: retrieved.catalog.length,
    contextChars,
  }
}
