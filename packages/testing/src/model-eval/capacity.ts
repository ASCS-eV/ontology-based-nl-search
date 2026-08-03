import { createEvaluationPolicy } from '@ontology-search/llm/evaluation'
import type { z } from 'zod'

import {
  createRunArtifacts,
  redactEndpoint,
  redactSecrets,
  sha256,
  writeManifest,
  writeSummaryArtifacts,
} from './artifacts.js'
import { getCandidate } from './candidates.js'
import { digestiblePolicy } from './runner.js'
import { launchServer } from './server.js'
import { collectHardwareInventory } from './telemetry.js'
import {
  assertHeldConstantPolicy,
  EVALUATION_SCHEMA_VERSION,
  type EvaluationSummary,
  type LaunchDescriptorSchema,
  type RunManifest,
} from './types.js'

const TARGET_TOKENS = 63_000

export interface CapacityOptions {
  repoRoot: string
  candidateId: string
  baseUrl: string
  servedModel?: string
  apiKey?: string
  tokenizerUrl?: string
  serverPid?: number
  launch?: z.infer<typeof LaunchDescriptorSchema>
  timeoutMs?: number
  signal?: AbortSignal
}

export async function runCapacityEvaluation(options: CapacityOptions) {
  const launched = options.launch ? await launchServer(options.launch, options.signal) : undefined
  try {
    return await runCapacityEvaluationWithServer(options, launched?.pid)
  } finally {
    await launched?.stop()
  }
}

async function runCapacityEvaluationWithServer(options: CapacityOptions, launchedPid?: number) {
  const candidate = getCandidate(options.candidateId)
  const servedModel = options.servedModel ?? candidate.source.huggingFaceId
  const effectivePid = launchedPid ?? options.serverPid
  // Derived from the same policy the semantic runner uses, so a capacity
  // manifest cannot describe a configuration that was never in effect.
  const effectivePolicy = digestiblePolicy(createEvaluationPolicy(servedModel), candidate)
  assertHeldConstantPolicy(effectivePolicy)
  const runDigest = sha256({
    candidate,
    profile: 'capacity',
    targetTokens: TARGET_TOKENS,
    tokenizerUrl: options.tokenizerUrl ? redactEndpoint(options.tokenizerUrl) : null,
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
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${candidate.id}-capacity-${runDigest.slice(0, 8)}`
  const artifacts = createRunArtifacts(options.repoRoot, runId)
  const createdAt = new Date().toISOString()
  const manifest: RunManifest = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId,
    createdAt,
    candidate,
    profile: 'capacity',
    corpus: {
      suite: 'envited-x',
      digest: sha256({ synthetic: true, targetTokens: TARGET_TOKENS }),
      caseCount: 1,
      repetitions: 1,
      warmups: 0,
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
    hardware: collectHardwareInventory(effectivePid),
  }
  writeManifest(artifacts.manifestPath, manifest)

  let capacity: NonNullable<EvaluationSummary['capacity']>
  if (!options.tokenizerUrl) {
    capacity = {
      status: 'not-supported',
      targetTokens: TARGET_TOKENS,
      reason: 'No compatible tokenizer endpoint was supplied',
    }
  } else {
    try {
      const built = await buildVerifiedPrompt({
        tokenizerUrl: options.tokenizerUrl,
        model: servedModel,
        targetTokens: TARGET_TOKENS,
        apiKey: options.apiKey,
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      })
      const response = await fetch(`${options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: headers(options.apiKey),
        body: JSON.stringify({
          model: servedModel,
          messages: [{ role: 'user', content: built.prompt }],
          max_tokens: 1,
          temperature: 0,
        }),
        signal: combinedSignal(options.timeoutMs, options.signal),
      })
      capacity = response.ok
        ? { status: 'passed', targetTokens: TARGET_TOKENS, promptTokens: built.tokens }
        : {
            status: 'failed',
            targetTokens: TARGET_TOKENS,
            promptTokens: built.tokens,
            reason: `Chat endpoint returned HTTP ${response.status}`,
          }
    } catch (error) {
      capacity = {
        status: isTokenizerUnsupported(error) ? 'not-supported' : 'failed',
        targetTokens: TARGET_TOKENS,
        reason: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const summary = emptyCapacitySummary(runId, candidate.id, capacity)
  manifest.completedAt = new Date().toISOString()
  writeManifest(artifacts.manifestPath, manifest)
  writeSummaryArtifacts(artifacts, summary)
  return { artifacts, manifest, summary }
}

async function buildVerifiedPrompt(options: {
  tokenizerUrl: string
  model: string
  targetTokens: number
  apiKey?: string
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<{ prompt: string; tokens: number }> {
  let low = 1
  let high = options.targetTokens * 2
  let best: { prompt: string; tokens: number } | null = null
  for (let attempt = 0; attempt < 18 && low <= high; attempt += 1) {
    const units = Math.floor((low + high) / 2)
    const prompt = 'ontology '.repeat(units)
    const tokens = await tokenize({ ...options, prompt })
    if (tokens <= options.targetTokens) {
      best = { prompt, tokens }
      low = units + 1
    } else {
      high = units - 1
    }
  }
  if (!best || best.tokens < options.targetTokens * 0.98) {
    throw new Error(
      `Tokenizer could not build a verified near-64k request (best ${best?.tokens ?? 0} tokens)`
    )
  }
  return best
}

async function tokenize(options: {
  tokenizerUrl: string
  model: string
  prompt: string
  apiKey?: string
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<number> {
  const response = await fetch(options.tokenizerUrl, {
    method: 'POST',
    headers: headers(options.apiKey),
    body: JSON.stringify({ model: options.model, prompt: options.prompt }),
    signal: combinedSignal(options.timeoutMs, options.signal),
  })
  if ([404, 405, 501].includes(response.status)) {
    throw new Error(`Tokenizer endpoint is not supported (HTTP ${response.status})`)
  }
  if (!response.ok) throw new Error(`Tokenizer endpoint returned HTTP ${response.status}`)
  const body = (await response.json()) as {
    count?: unknown
    tokens?: unknown
  }
  const count =
    typeof body.count === 'number'
      ? body.count
      : Array.isArray(body.tokens)
        ? body.tokens.length
        : undefined
  if (!Number.isInteger(count) || (count ?? 0) <= 0) {
    throw new Error('Tokenizer endpoint did not return an integer count or token array')
  }
  return count!
}

/**
 * Capacity measures one synthetic request, so it has no semantic metrics.
 * They are `null` — "not measured" — rather than `0`, which rendered a report
 * full of 0.0% and read as a catastrophic model failure.
 */
function emptyCapacitySummary(
  runId: string,
  candidateId: string,
  capacity: NonNullable<EvaluationSummary['capacity']>
): EvaluationSummary {
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId,
    candidateId,
    profile: 'capacity',
    suite: 'envited-x',
    cases: 1,
    measuredSamples: 0,
    metrics: {
      submissionRate: null,
      rawExact: null,
      validatedExact: null,
      fieldPrecision: null,
      fieldRecall: null,
      gapPrecision: null,
      gapRecall: null,
      referenceTopologyAccuracy: null,
      lookupEfficiency: null,
      fallbackRate: null,
      compilationValidity: null,
      latencyMs: { p50: null, p95: null, mad: null },
      tokens: { inputMedian: null, outputMedian: null },
      peakRamBytes: null,
      peakVramBytes: null,
      categoryValidatedExact: {},
      localeValidatedExact: {},
      inventedIdentifierCount: 0,
    },
    gates: {
      protocol: null,
      quality: null,
      // `not-supported` is not a failure: nothing about the candidate was
      // disproved, the measurement simply could not be taken. Only a real
      // `failed` outcome fails the gate.
      passing: capacity.status !== 'failed',
      failures: capacity.status === 'failed' ? [capacity.reason ?? capacity.status] : [],
    },
    comparablePerformance: true,
    capacity,
  }
}

function headers(apiKey?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  }
}

function combinedSignal(timeoutMs = 120_000, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function isTokenizerUnsupported(error: unknown): boolean {
  return error instanceof Error && /tokenizer endpoint is not supported/i.test(error.message)
}
