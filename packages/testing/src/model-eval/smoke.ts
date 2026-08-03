import {
  createEvaluationPolicy,
  createOpenAIResponsesModel,
  evaluateStructuredSearch,
  SUBMIT_TOOL_NAME,
} from '@ontology-search/llm/evaluation'
import { buildTermIndex, getInitializedStore, validateSparql } from '@ontology-search/search'

import { findUnknownIdentifiers, validateGoldCorpus } from './ontology-validation.js'
import { findProtocolErrors } from './protocol.js'
import { scoreSample } from './scoring.js'
import { withTimeout } from './timeout.js'
import { type GoldCase, SearchSlotsSchema } from './types.js'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1'

export interface SmokeOptions {
  model: string
  gold: GoldCase
  apiKey: string
  baseUrl?: string
  timeoutMs: number
  signal?: AbortSignal
}

export interface SmokeResult {
  kind: 'non-ranked-smoke'
  model: string
  caseId: string
  durationMs: number
  submitted: boolean
  missingSubmitFallback: boolean
  rawExact: boolean
  validatedExact: boolean
  compilationValid: boolean
  referenceTopologyExact: boolean
  toolPath: string[]
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  inventedIdentifiers: string[]
  protocolErrors: string[]
  passed: boolean
}

/** Run one real, scored case without attributing it to a local candidate. */
export async function runSmokeEvaluation(options: SmokeOptions): Promise<SmokeResult> {
  await validateGoldCorpus([options.gold])
  const termIndex = await buildTermIndex(await getInitializedStore())
  // Hosted reasoning models may reject sampling parameters entirely. Local
  // ranked artifacts still use temperature 0; this non-ranked smoke omits it.
  const policy = { ...createEvaluationPolicy(options.model), temperature: undefined }
  const model = createOpenAIResponsesModel({
    baseUrl: options.baseUrl ?? OPENAI_RESPONSES_URL,
    model: options.model,
    apiKey: options.apiKey,
  })

  const started = performance.now()
  const evaluation = await withTimeout(
    (signal) =>
      evaluateStructuredSearch(options.gold.query, {
        model,
        policy,
        streaming: true,
        providerOptions: { openai: { store: false } },
        signal,
      }),
    options.timeoutMs,
    options.signal
  )
  const durationMs = performance.now() - started
  const rawSlots = evaluation.rawSubmission
    ? SearchSlotsSchema.parse(evaluation.rawSubmission.slots)
    : null
  const validatedSlots = evaluation.validatedResponse.slots
    ? SearchSlotsSchema.parse(evaluation.validatedResponse.slots)
    : null
  const lookupNames = evaluation.trace.toolCalls
    .filter((call) => call.toolName !== SUBMIT_TOOL_NAME)
    .map((call) => call.toolName)
  const compilationValid = validateSparql(evaluation.validatedResponse.sparql).valid
  const score = scoreSample({
    gold: options.gold,
    raw: rawSlots,
    validated: validatedSlots,
    actualGapTerms: evaluation.validatedResponse.gaps.map((gap) => gap.term || '<empty>'),
    lookupNames,
    compilationValid,
  })
  const protocolErrors = findProtocolErrors(evaluation.trace.toolCalls, policy.maxSteps)
  if (evaluation.trace.missingSubmitFallback) {
    protocolErrors.push(`${SUBMIT_TOOL_NAME} was not completed`)
  }
  const inventedIdentifiers = findUnknownIdentifiers(validatedSlots, termIndex)
  const passed =
    protocolErrors.length === 0 &&
    score.validatedExact &&
    score.compilationValid &&
    inventedIdentifiers.length === 0

  return {
    kind: 'non-ranked-smoke',
    model: options.model,
    caseId: options.gold.id,
    durationMs,
    submitted: evaluation.rawSubmission !== null,
    missingSubmitFallback: evaluation.trace.missingSubmitFallback,
    rawExact: score.rawExact,
    validatedExact: score.validatedExact,
    compilationValid: score.compilationValid,
    referenceTopologyExact: score.referenceTopologyExact,
    toolPath: evaluation.trace.toolCalls.map((call) => call.toolName),
    ...(evaluation.trace.usage ? { usage: evaluation.trace.usage } : {}),
    inventedIdentifiers,
    protocolErrors,
    passed,
  }
}
