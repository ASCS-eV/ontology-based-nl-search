import { randomUUID } from 'node:crypto'

import {
  createEvaluationPolicy,
  createOpenAIResponsesModel,
  evaluateStructuredSearch,
  SUBMIT_TOOL_NAME,
} from '@ontology-search/llm/evaluation'
import { buildTermIndex, getInitializedStore, validateSparql } from '@ontology-search/search'

import { readCodexCliCredentials, readCodexCliVersion } from './codex-auth.js'
import { findUnknownIdentifiers, validateGoldCorpus } from './ontology-validation.js'
import { findProtocolErrors } from './protocol.js'
import { scoreSample } from './scoring.js'
import { withTimeout } from './timeout.js'
import { type GoldCase, SearchSlotsSchema } from './types.js'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1'

/**
 * The endpoint the Codex CLI itself talks to for ChatGPT-subscription auth.
 *
 * This is NOT `api.openai.com`: a ChatGPT subscription credential is not valid
 * against the platform API, so there is no published host to use instead. The
 * repository's `claude-cli` provider is the same idea — reuse the CLI's stored
 * OAuth token through a normal AI SDK provider — but Anthropic documents that
 * flow (`anthropic-beta: oauth-2025-04-20`) against its public API host, and
 * OpenAI publishes no equivalent. Two consequences follow, and both are the
 * operator's to accept:
 *
 *   1. Stability — an endpoint the vendor does not document for third-party
 *      clients can change shape without notice.
 *   2. Terms — whether a non-Codex client may present this credential is a
 *      question about the operator's own ChatGPT account.
 *
 * `--auth api-key` against {@link OPENAI_RESPONSES_URL} carries neither caveat
 * and remains the default for anyone who has a platform key.
 */
const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex'

export type SmokeAuth = 'codex-cli' | 'api-key'

export interface SmokeOptions {
  auth: SmokeAuth
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
  auth: SmokeAuth
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
  const endpoint = resolveEndpoint(options)
  const model = createOpenAIResponsesModel({
    baseUrl: endpoint.baseUrl,
    model: options.model,
    apiKey: endpoint.apiKey,
    ...(endpoint.headers ? { headers: endpoint.headers } : {}),
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

/**
 * Pick the endpoint and credential for this run.
 *
 * Credentials stay in memory: the Codex token and account id are passed
 * straight to the provider and never reach a run artifact, a log line, or the
 * JSON this command prints.
 */
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
  return {
    baseUrl: CODEX_RESPONSES_URL,
    apiKey: credentials.accessToken,
    headers: {
      'ChatGPT-Account-ID': credentials.accountId,
      'OpenAI-Beta': 'responses=v1',
      // The backend gates on client identity. `originator` names THIS client
      // rather than impersonating the Codex CLI, so the traffic is
      // attributable; `version` is the installed CLI's version, which the
      // endpoint uses for compatibility.
      originator: 'ontology_search_model_eval',
      version: readCodexCliVersion(),
      session_id: randomUUID(),
    },
  }
}
