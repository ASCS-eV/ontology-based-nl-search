import {
  type AgentEvaluationResult,
  createEvaluationPolicy,
  createOpenAICompatibleModel,
  evaluateStructuredSearch,
  type EvaluationAgentPolicy,
  SUBMIT_TOOL_NAME,
} from '@ontology-search/llm/evaluation'
import { buildTermIndex, getInitializedStore, validateSparql } from '@ontology-search/search'
import type { z } from 'zod'

import {
  appendSample,
  createRunArtifacts,
  redactEndpoint,
  redactSecrets,
  type RunArtifacts,
  sha256,
  writeManifest,
  writeSummaryArtifacts,
} from './artifacts.js'
import { getCandidate } from './candidates.js'
import { aggregateSummary } from './gates.js'
import { findUnknownIdentifiers, validateGoldCorpus } from './ontology-validation.js'
import { planProfile, type ProfileName, roundRobinSamples } from './profiles.js'
import { findProtocolErrors } from './protocol.js'
import { scoreSample } from './scoring.js'
import { type LaunchedServer, launchServer } from './server.js'
import { collectHardwareInventory, TelemetrySampler } from './telemetry.js'
import { withTimeout } from './timeout.js'
import {
  assertHeldConstantPolicy,
  type Candidate,
  EVALUATION_SCHEMA_VERSION,
  type EvaluationSample,
  type EvaluationSearchSlots,
  type GoldCase,
  LaunchDescriptorSchema,
  type RunManifest,
  SampleSchema,
  SearchSlotsSchema,
} from './types.js'

export { withTimeout }

type LaunchDescriptor = z.infer<typeof LaunchDescriptorSchema>

export interface EvaluationRunOptions {
  repoRoot: string
  candidateId: string
  profile: ProfileName
  baseUrl: string
  servedModel?: string
  apiKey?: string
  serverPid?: number
  launch?: LaunchDescriptor
  timeoutMs?: number
  cases: GoldCase[]
  protocolCases: GoldCase[]
  signal?: AbortSignal
}

export interface EvaluationRunResult {
  artifacts: RunArtifacts
  manifest: RunManifest
  samples: EvaluationSample[]
  summary: ReturnType<typeof aggregateSummary>
}

export async function runEvaluation(options: EvaluationRunOptions): Promise<EvaluationRunResult> {
  if (options.profile === 'capacity') {
    throw new Error('Capacity uses runCapacityEvaluation, not the semantic runner')
  }
  if (options.profile === 'cold-load' && !options.launch) {
    throw new Error('cold-load requires --launch so every measured sample can start a fresh server')
  }

  const candidate = getCandidate(options.candidateId)
  const servedModel = options.servedModel ?? candidate.source.huggingFaceId
  const plan = planProfile(options.profile, options.cases, options.protocolCases)

  // This is deliberately before model construction, launch, or endpoint I/O.
  await validateGoldCorpus(plan.cases)
  const termIndex = await buildTermIndex(await getInitializedStore())

  const policy = createEvaluationPolicy(servedModel)
  const effectivePolicy = digestiblePolicy(policy, candidate)
  // Fail before any endpoint I/O if the evaluated policy drifted from the
  // comparability contract, rather than recording conformant-looking
  // constants over a run that used something else.
  assertHeldConstantPolicy(effectivePolicy)
  const corpusDigest = sha256(plan.cases)
  const runDigest = sha256({
    candidate,
    corpusDigest,
    policy: effectivePolicy,
    profile: options.profile,
    repetitions: plan.repetitions,
    warmups: plan.warmups,
    runtime: {
      servedModel,
      baseUrl: redactEndpoint(options.baseUrl),
      collection: options.launch ? 'launched' : options.serverPid ? 'server-pid' : 'client-only',
      launch: options.launch
        ? {
            command: redactSecrets([options.launch.executable, ...options.launch.args]),
            readinessUrl: redactEndpoint(options.launch.readinessUrl),
            shutdownTimeoutMs: options.launch.shutdownTimeoutMs,
          }
        : null,
    },
  })
  const runId = makeRunId(candidate.id, options.profile, runDigest)
  const artifacts = createRunArtifacts(options.repoRoot, runId)

  let sharedServer: LaunchedServer | undefined
  if (options.launch && options.profile !== 'cold-load') {
    sharedServer = await launchServer(options.launch, options.signal)
  }
  const effectivePid = sharedServer?.pid ?? options.serverPid
  const hardware = collectHardwareInventory(effectivePid)
  const createdAt = new Date().toISOString()
  const manifest: RunManifest = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId,
    createdAt,
    candidate,
    profile: options.profile,
    corpus: {
      suite: plan.cases[0]?.suite ?? 'envited-x',
      digest: corpusDigest,
      caseCount: plan.cases.length,
      repetitions: plan.repetitions,
      warmups: plan.warmups,
    },
    policy: effectivePolicy,
    runDigest,
    endpoint: {
      baseUrl: redactEndpoint(options.baseUrl),
      model: servedModel,
      collection: options.launch ? 'launched' : options.serverPid ? 'server-pid' : 'client-only',
      ...(options.launch
        ? {
            launch: {
              command: redactSecrets([options.launch.executable, ...options.launch.args]),
              readinessUrl: redactEndpoint(options.launch.readinessUrl),
              shutdownTimeoutMs: options.launch.shutdownTimeoutMs,
            },
          }
        : {}),
    },
    hardware,
  }
  writeManifest(artifacts.manifestPath, manifest)

  const samples: EvaluationSample[] = []
  try {
    for (const scheduled of roundRobinSamples(plan)) {
      const sample = await runOneSample({
        ...options,
        gold: scheduled.gold,
        repetition: scheduled.repetition,
        warmup: scheduled.warmup,
        runId,
        servedModel,
        policy,
        termIndex,
        sharedServer,
      })
      samples.push(sample)
      appendSample(artifacts.samplesPath, sample)
      if (options.signal?.aborted) {
        throw options.signal.reason ?? new DOMException('Aborted', 'AbortError')
      }
    }
  } finally {
    await sharedServer?.stop()
  }

  const summary = aggregateSummary({
    runId,
    candidateId: candidate.id,
    profile: options.profile,
    samples,
    cases: plan.cases,
  })
  manifest.completedAt = new Date().toISOString()
  writeManifest(artifacts.manifestPath, manifest)
  writeSummaryArtifacts(artifacts, summary)
  return { artifacts, manifest, samples, summary }
}

interface SampleOptions extends EvaluationRunOptions {
  gold: GoldCase
  repetition: number
  warmup: boolean
  runId: string
  servedModel: string
  policy: EvaluationAgentPolicy
  termIndex: Awaited<ReturnType<typeof buildTermIndex>>
  sharedServer?: LaunchedServer
}

async function runOneSample(options: SampleOptions): Promise<EvaluationSample> {
  const sampleId = `${options.gold.id}-r${options.repetition}${options.warmup ? '-warmup' : ''}`
  const startedAt = new Date().toISOString()
  const monotonicStart = performance.now()
  let localServer: LaunchedServer | undefined
  let evaluation: AgentEvaluationResult | undefined
  let error: string | undefined

  try {
    if (options.profile === 'cold-load' && options.launch) {
      localServer = await launchServer(options.launch, options.signal)
    }
    const serverPid = localServer?.pid ?? options.sharedServer?.pid ?? options.serverPid
    const telemetry = new TelemetrySampler(serverPid)
    telemetry.start()
    try {
      const model = createOpenAICompatibleModel({
        baseUrl: options.baseUrl,
        model: options.servedModel,
        apiKey: options.apiKey,
      })
      evaluation = await withTimeout(
        (signal) =>
          evaluateStructuredSearch(options.gold.query, {
            model,
            policy: options.policy,
            signal,
          }),
        options.timeoutMs ?? 120_000,
        options.signal
      )
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }
    const telemetryResult = await telemetry.stop()
    const durationMs = performance.now() - monotonicStart
    // `safeParse`, never `parse`. Scoring one sample must never be able to
    // abort the run: an unscoreable payload is a finding about the candidate
    // and belongs in this sample's diagnostics, not in a stack trace that
    // discards every remaining case and the summary.
    const rawParse = readSlots(evaluation?.rawSubmission?.slots)
    const validatedParse = readSlots(evaluation?.validatedResponse.slots)
    const schemaErrors = [
      ...rawParse.errors.map((issue) => `Raw submission: ${issue}`),
      ...validatedParse.errors.map((issue) => `Validated slots: ${issue}`),
    ]
    const rawSlots = rawParse.slots
    const validatedSlots = validatedParse.slots
    const actualGapTerms = (evaluation?.validatedResponse.gaps ?? []).map((gap) =>
      gap.term === '' ? '<empty>' : gap.term
    )
    const lookupNames = (evaluation?.trace.toolCalls ?? [])
      .filter((call) => call.toolName !== SUBMIT_TOOL_NAME)
      .map((call) => call.toolName)
    const compilationValid = evaluation
      ? validateSparql(evaluation.validatedResponse.sparql).valid
      : false
    const score = scoreSample({
      gold: options.gold,
      raw: rawSlots,
      validated: validatedSlots,
      actualGapTerms,
      lookupNames,
      compilationValid,
    })
    // Protocol errors describe what the model did. A transport failure is
    // recorded on its own field so a flaky endpoint is never scored as a
    // protocol violation.
    const protocolErrors = [
      ...findProtocolErrors(evaluation?.trace.toolCalls ?? [], options.policy.maxSteps),
      ...schemaErrors,
    ]
    const comparabilityReasons = performanceComparabilityReasons(telemetryResult)
    const trace = evaluation?.trace ?? {
      finishReason: 'error',
      toolCalls: [],
      promptChars: 0,
      retrieval: {
        domains: [],
        confidence: 0,
        cardCount: 0,
        fragmentCount: 0,
        catalogCount: 0,
        contextChars: 0,
      },
      missingSubmitFallback: true,
      rawSubmission: null,
    }

    return SampleSchema.parse({
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      runId: options.runId,
      sampleId,
      caseId: options.gold.id,
      repetition: options.repetition,
      warmup: options.warmup,
      startedAt,
      durationMs,
      monotonic: true,
      rawSubmission: rawSlots,
      validatedSlots,
      actualGaps: actualGapTerms.map((term) => ({ term })),
      trace: {
        finishReason: trace.finishReason,
        ...(trace.usage ? { usage: trace.usage } : {}),
        toolCalls: trace.toolCalls,
        promptChars: trace.promptChars,
        retrieval: trace.retrieval,
        missingSubmitFallback: trace.missingSubmitFallback,
      },
      score,
      telemetry: {
        peakRssBytes: telemetryResult.peakRssBytes,
        peakVramBytes: telemetryResult.peakVramBytes,
        peakGpuUtilizationPercent: telemetryResult.peakGpuUtilizationPercent,
        peakGpuTemperatureC: telemetryResult.peakGpuTemperatureC,
        peakGpuPowerW: telemetryResult.peakGpuPowerW,
        cpuTimeMs: telemetryResult.cpuTimeMs,
        readBytes: telemetryResult.readBytes,
        writeBytes: telemetryResult.writeBytes,
        swapGrowthBytes: telemetryResult.swapGrowthBytes,
        competingGpuLoad: telemetryResult.competingGpuLoad,
      },
      comparable: comparabilityReasons.length === 0,
      diagnostic: {
        protocolErrors,
        inventedIdentifiers: findUnknownIdentifiers(validatedSlots, options.termIndex),
        comparabilityReasons,
        samplingCoverage: {
          processTree: telemetryResult.processTreeCoverage,
          gpu: telemetryResult.gpuCoverage,
          samples: telemetryResult.samples,
        },
      },
      ...(error ? { transportError: error, error } : {}),
    })
  } finally {
    await localServer?.stop()
  }
}

/**
 * Parse slots for scoring without ever throwing. The schema is the production
 * wire contract, so a rejection here means the payload was malformed rather
 * than merely weak — either way it is recorded, not fatal.
 */
function readSlots(slots: unknown): {
  slots: EvaluationSearchSlots | null
  errors: string[]
} {
  if (slots === undefined || slots === null) return { slots: null, errors: [] }
  const parsed = SearchSlotsSchema.safeParse(slots)
  return parsed.success
    ? { slots: parsed.data, errors: [] }
    : {
        slots: null,
        errors: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
        ),
      }
}

export function performanceComparabilityReasons(
  telemetry: Awaited<ReturnType<TelemetrySampler['stop']>>
): string[] {
  const reasons: string[] = []
  if ((telemetry.swapGrowthBytes ?? 0) > 0) reasons.push('swap-growth')
  if (telemetry.serverRestarted) reasons.push('server-restart')
  if (telemetry.processTreeCoverage !== 'complete') reasons.push('process-tree-sampling-incomplete')
  if (telemetry.gpuCoverage !== 'complete') reasons.push('gpu-sampling-incomplete')
  if (telemetry.samples === 0) reasons.push('no-telemetry-samples')
  if (telemetry.competingGpuLoad) reasons.push('competing-gpu-load')
  return reasons
}

/** The harness issues one request at a time so latency is attributable. */
const EVALUATION_CONCURRENCY = 1

/**
 * Record the policy that ACTUALLY ran. Every field is read from the live
 * policy or the candidate, so a change to either shows up in both the
 * manifest and the run digest instead of being masked by a restated constant.
 */
export function digestiblePolicy(
  policy: EvaluationAgentPolicy,
  candidate: Candidate
): RunManifest['policy'] {
  return {
    contextTokens: candidate.contextTokens,
    temperature: policy.temperature ?? null,
    concurrency: EVALUATION_CONCURRENCY,
    maxAgentSteps: policy.maxSteps,
    lookupTools: [...policy.lookupTools],
    retrieval: { ...policy.retrieval },
  }
}

function makeRunId(candidateId: string, profile: ProfileName, digest: string): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${candidateId}-${profile}-${digest.slice(0, 8)}`
}
