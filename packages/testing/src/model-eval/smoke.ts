import { randomUUID } from 'node:crypto'

import {
  createEvaluationPolicy,
  createOpenAIResponsesModel,
  evaluateStructuredSearch,
} from '@ontology-search/llm/evaluation'
import { buildTermIndex, getInitializedStore, validateSparql } from '@ontology-search/search'

import { readCodexCliCredentials, readCodexCliVersion } from './codex-auth.js'
import { findUnknownIdentifiers, validateGoldCorpus } from './ontology-validation.js'
import { scoreSample } from './scoring.js'
import { type GoldCase, SearchSlotsSchema } from './types.js'

const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex'
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1'

export interface SmokeOptions {
  auth: 'codex-cli' | 'api-key'
  model: string
  gold: GoldCase
  apiKey?: string
  baseUrl?: string
  codexHome?: string
  timeoutMs: number
  signal?: AbortSignal
}

export interface SmokeResult {
  kind: 'non-ranked-smoke'
  auth: SmokeOptions['auth']
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
  const endpoint = resolveEndpoint(options)
  // Hosted reasoning models may reject sampling parameters entirely. Local
  // ranked artifacts still use temperature 0; this non-ranked smoke omits it.
  const policy = { ...createEvaluationPolicy(options.model), temperature: undefined }
  const model = createOpenAIResponsesModel({
    baseUrl: endpoint.baseUrl,
    model: options.model,
    apiKey: endpoint.apiKey,
    headers: endpoint.headers,
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
    .filter((call) => call.toolName !== 'submit_slots')
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
  const protocolErrors = findProtocolErrors(evaluation.trace.toolCalls)
  if (evaluation.trace.missingSubmitFallback) protocolErrors.push('submit_slots was not completed')
  const inventedIdentifiers = findUnknownIdentifiers(validatedSlots, termIndex)
  const passed =
    protocolErrors.length === 0 &&
    score.validatedExact &&
    score.compilationValid &&
    inventedIdentifiers.length === 0

  return {
    kind: 'non-ranked-smoke',
    auth: options.auth,
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

function resolveEndpoint(options: SmokeOptions): {
  baseUrl: string
  apiKey: string
  headers?: Record<string, string>
} {
  if (options.auth === 'api-key') {
    if (!options.apiKey) throw new Error('--api-key is required when --auth api-key is used')
    return { baseUrl: options.baseUrl ?? OPENAI_RESPONSES_URL, apiKey: options.apiKey }
  }

  const credentials = readCodexCliCredentials(options.codexHome)
  const cliVersion = readCodexCliVersion()
  return {
    baseUrl: CODEX_RESPONSES_URL,
    apiKey: credentials.accessToken,
    headers: {
      'ChatGPT-Account-ID': credentials.accountId,
      'OpenAI-Beta': 'responses=v1',
      originator: 'ontology_search_model_eval',
      version: cliVersion,
      session_id: randomUUID(),
    },
  }
}

function findProtocolErrors(
  calls: Array<{ step: number; toolName: string; output?: unknown }>
): string[] {
  const known = new Set([
    'find_terms',
    'describe_shape',
    'list_values',
    'probe_data',
    'submit_slots',
  ])
  const errors: string[] = []
  for (const call of calls) {
    if (!known.has(call.toolName)) errors.push(`Unknown tool "${call.toolName}"`)
    if (call.step >= 3) errors.push(`Tool "${call.toolName}" exceeded the three-step budget`)
    if (call.output === undefined) errors.push(`Tool "${call.toolName}" had no schema-valid result`)
  }
  return errors
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parent?: AbortSignal
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = parent ? AbortSignal.any([parent, timeout]) : timeout
  if (signal.aborted) throw signal.reason
  let rejectOnAbort: ((reason: unknown) => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = reject
  })
  const onAbort = () => rejectOnAbort?.(signal.reason)
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    return await Promise.race([operation(signal), aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
