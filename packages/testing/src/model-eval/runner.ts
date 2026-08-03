import {
  type AgentEvaluationResult,
  createEvaluationPolicy,
  createOpenAICompatibleModel,
  evaluateStructuredSearch,
  type EvaluationAgentPolicy,
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
import { scoreSample } from './scoring.js'
import { type LaunchedServer, launchServer } from './server.js'
import { collectHardwareInventory, TelemetrySampler } from './telemetry.js'
import {
  EVALUATION_SCHEMA_VERSION,
  type EvaluationSample,
  type GoldCase,
  LaunchDescriptorSchema,
  type RunManifest,
  SampleSchema,
  SearchSlotsSchema,
} from './types.js'

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
  const corpusDigest = sha256(plan.cases)
  const runDigest = sha256({
    candidate,
    corpusDigest,
    policy: digestiblePolicy(policy),
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
    policy: digestiblePolicy(policy),
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
    const rawSlots = evaluation?.rawSubmission
      ? SearchSlotsSchema.parse(evaluation.rawSubmission.slots)
      : null
    const validatedSlots = evaluation
      ? SearchSlotsSchema.parse(evaluation.validatedResponse.slots)
      : null
    const actualGapTerms = (evaluation?.validatedResponse.gaps ?? []).map((gap) =>
      gap.term === '' ? '<empty>' : gap.term
    )
    const lookupNames = (evaluation?.trace.toolCalls ?? [])
      .filter((call) => call.toolName !== 'submit_slots')
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
    const protocolErrors = protocolErrorsFor(evaluation)
    if (error) protocolErrors.push(error)
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
      ...(error ? { error } : {}),
    })
  } finally {
    await localServer?.stop()
  }
}

function protocolErrorsFor(evaluation?: AgentEvaluationResult): string[] {
  if (!evaluation) return []
  const known = new Set([
    'find_terms',
    'describe_shape',
    'list_values',
    'probe_data',
    'submit_slots',
  ])
  const errors: string[] = []
  for (const call of evaluation.trace.toolCalls) {
    if (!known.has(call.toolName)) errors.push(`Unknown tool "${call.toolName}"`)
    if (call.step >= 3) errors.push(`Tool "${call.toolName}" exceeded the three-step budget`)
    if (call.output === undefined) errors.push(`Tool "${call.toolName}" had no schema-valid result`)
  }
  return errors
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

function digestiblePolicy(policy: EvaluationAgentPolicy): RunManifest['policy'] {
  return {
    contextTokens: 65_536,
    temperature: 0,
    concurrency: 1,
    maxAgentSteps: 3,
    lookupTools: [...policy.lookupTools],
    retrieval: { ...policy.retrieval },
  }
}

function makeRunId(candidateId: string, profile: ProfileName, digest: string): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${candidateId}-${profile}-${digest.slice(0, 8)}`
}

export async function withTimeout<T>(
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
