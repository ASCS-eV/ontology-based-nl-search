import { SCHEMA_TOOL_NAMES } from '@ontology-search/llm/evaluation'
import {
  type ReferenceFilterInput,
  referenceFilterWireSchema,
  searchSlotsWireSchema,
} from '@ontology-search/slots/slot-wire-schema'
import { z } from 'zod'

export const EVALUATION_SCHEMA_VERSION = '1.0.0' as const
export const profileNames = [
  'protocol',
  'quality',
  'warm-performance',
  'cold-load',
  'capacity',
] as const
export const ProfileNameSchema = z.enum(profileNames)

/**
 * The evaluation harness scores against the SAME schema the production agent
 * accepts — never a re-declared copy. A stricter local definition would reject
 * submissions production takes, turning a scoreable weak-model answer into a
 * harness crash, so the contract is imported rather than restated.
 */
export const ReferenceSlotsSchema = referenceFilterWireSchema
export type ReferenceSlots = ReferenceFilterInput

export const SearchSlotsSchema = searchSlotsWireSchema
export type EvaluationSearchSlots = z.infer<typeof SearchSlotsSchema>

export const ExpectedGapSchema = z.object({
  term: z.string().min(1),
  kind: z
    .enum(['missing-domain', 'missing-property', 'missing-value', 'ambiguous', 'unsupported'])
    .optional(),
})

/** Lookup-tool names come from the agent itself, never a restated list. */
export const LookupToolNameSchema = z.enum(SCHEMA_TOOL_NAMES)

export const ToolPolicySchema = z.object({
  allowed: z.array(LookupToolNameSchema).default([]),
  required: z.array(LookupToolNameSchema).default([]),
  maxLookups: z.number().int().min(0).max(2),
  directSubmissionAllowed: z.boolean().default(true),
})

export const GoldCaseSchema = z.object({
  schemaVersion: z.literal(EVALUATION_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]+$/),
  suite: z.enum(['envited-x', 'toyverse']),
  locale: z.enum(['en', 'de', 'fr', 'ja']),
  query: z.string(),
  expected: z.object({
    slots: SearchSlotsSchema,
    gaps: z.array(ExpectedGapSchema).default([]),
  }),
  categories: z.array(z.string().min(1)).min(1),
  risk: z.enum(['normal', 'high']),
  allowUnknownExpected: z.boolean().default(false),
  toolPolicy: ToolPolicySchema,
  legacyId: z
    .string()
    .regex(/^legacy-\d{3}$/)
    .optional(),
  legacyQuery: z.string().optional(),
})
export type GoldCase = z.infer<typeof GoldCaseSchema>

export const CandidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9.-]+$/),
  displayName: z.string().min(1),
  cohort: z.enum(['core', 'control', 'floor', 'conditional', 'ceiling']),
  runnable: z.literal(true),
  source: z.object({
    huggingFaceId: z.string().min(3),
    revision: z.string().regex(/^[0-9a-f]{40}$/),
    url: z.string().url(),
    license: z.enum(['Apache-2.0', 'MIT']),
    licenseUrl: z.string().url(),
  }),
  contextTokens: z.literal(65_536),
  runtime: z.object({
    engine: z.enum(['vllm', 'llama.cpp', 'sglang']),
    toolParser: z.string().min(1),
    reasoning: z.literal('disabled'),
    temperature: z.literal(0),
    concurrency: z.literal(1),
    chatTemplateArgs: z.record(z.string(), z.unknown()).default({}),
  }),
  quantization: z.string().min(1),
  weightEstimateGiB: z.number().positive(),
  kvCache64kEstimateGiB: z.number().positive(),
  hardwareTier: z.enum(['16', '24', '32-48']),
  notes: z.string().min(1),
})
export type Candidate = z.infer<typeof CandidateSchema>

export const CandidateInventorySchema = z.object({
  schemaVersion: z.literal(EVALUATION_SCHEMA_VERSION),
  candidates: z.array(CandidateSchema).min(1),
  exclusions: z.array(
    z.object({
      model: z.string().min(1),
      sourceUrl: z.string().url(),
      license: z.string().min(1),
      reason: z.string().min(1),
    })
  ),
})
export type CandidateInventory = z.infer<typeof CandidateInventorySchema>

export const CoverageStateSchema = z.enum([
  'complete',
  'partial',
  'client-only',
  'permission-denied',
  'tool-missing',
  'platform-unsupported',
  'rocm-unsupported',
  'metal-unsupported',
])

export const HardwareInventorySchema = z.object({
  platform: z.string(),
  release: z.string(),
  architecture: z.string(),
  container: z.string().nullable(),
  wsl: z.boolean(),
  cpuModel: z.string(),
  logicalCores: z.number().int().positive(),
  ramBytes: z.number().nonnegative(),
  swapBytes: z.number().nonnegative(),
  cgroupMemoryLimitBytes: z.number().nonnegative().nullable(),
  gpu: z.array(
    z.object({
      uuid: z.string(),
      model: z.string(),
      vramTotalBytes: z.number().nonnegative(),
    })
  ),
  coverage: z.object({
    processTree: CoverageStateSchema,
    gpu: CoverageStateSchema,
  }),
})
export type HardwareInventory = z.infer<typeof HardwareInventorySchema>

export const LaunchDescriptorSchema = z.object({
  executable: z.string().min(1),
  args: z.array(z.string()),
  readinessUrl: z.string().url(),
  /**
   * How long the server may take to become ready. Distinct from
   * `shutdownTimeoutMs`: loading a multi-billion-parameter checkpoint into
   * VRAM routinely takes minutes, while a graceful stop should take seconds.
   * Sharing one field capped startup at the shutdown budget and made
   * `cold-load` — the profile that exists to measure startup — unusable.
   */
  readinessTimeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(30 * 60_000)
    .default(10 * 60_000),
  shutdownTimeoutMs: z.number().int().min(100).max(120_000),
})

export const RunManifestSchema = z.object({
  schemaVersion: z.literal(EVALUATION_SCHEMA_VERSION),
  runId: z.string().min(1),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  candidate: CandidateSchema,
  profile: ProfileNameSchema,
  corpus: z.object({
    suite: z.enum(['envited-x', 'toyverse']),
    digest: z.string().regex(/^[0-9a-f]{64}$/),
    caseCount: z.number().int().positive(),
    repetitions: z.number().int().positive(),
    warmups: z.number().int().nonnegative(),
  }),
  /**
   * What the run ACTUALLY used. These were literals in an earlier revision,
   * which meant the manifest restated constants instead of recording the
   * effective policy: changing the evaluated policy would alter behaviour
   * without altering the manifest or the run digest. The held-constant
   * contract is now enforced by `assertHeldConstantPolicy`, where a violation
   * is a loud error rather than a silent mis-record.
   */
  policy: z.object({
    contextTokens: z.number().int().positive(),
    temperature: z.number().nullable(),
    concurrency: z.number().int().positive(),
    maxAgentSteps: z.number().int().positive(),
    lookupTools: z.array(z.string()).min(1),
    retrieval: z.object({
      maxDomains: z.number().int().positive(),
      maxCards: z.number().int().positive(),
      maxContextChars: z.number().int().positive(),
    }),
  }),
  runDigest: z.string().regex(/^[0-9a-f]{64}$/),
  endpoint: z.object({
    baseUrl: z.string(),
    model: z.string(),
    collection: z.enum(['client-only', 'server-pid', 'launched']),
    launch: z
      .object({
        command: z.array(z.string()).min(1),
        readinessUrl: z.string(),
        shutdownTimeoutMs: z.number().int().positive(),
      })
      .optional(),
  }),
  hardware: HardwareInventorySchema,
})
export type RunManifest = z.infer<typeof RunManifestSchema>

export const ToolTraceSchema = z.object({
  step: z.number().int().nonnegative(),
  toolName: z.string(),
  callId: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
})

export const DiagnosticSchema = z.object({
  protocolErrors: z.array(z.string()),
  inventedIdentifiers: z.array(z.string()),
  comparabilityReasons: z.array(z.string()),
  samplingCoverage: z.object({
    processTree: CoverageStateSchema,
    gpu: CoverageStateSchema,
    samples: z.number().int().nonnegative(),
  }),
})
export type EvaluationDiagnostic = z.infer<typeof DiagnosticSchema>

export const ScoreSchema = z.object({
  rawExact: z.boolean(),
  validatedExact: z.boolean(),
  fieldTruePositive: z.number().int().nonnegative(),
  fieldFalsePositive: z.number().int().nonnegative(),
  fieldFalseNegative: z.number().int().nonnegative(),
  gapTruePositive: z.number().int().nonnegative(),
  gapFalsePositive: z.number().int().nonnegative(),
  gapFalseNegative: z.number().int().nonnegative(),
  referenceTopologyExact: z.boolean(),
  lookupCount: z.number().int().nonnegative(),
  requiredLookupsSatisfied: z.boolean(),
  compilationValid: z.boolean(),
})

export const SampleSchema = z.object({
  schemaVersion: z.literal(EVALUATION_SCHEMA_VERSION),
  runId: z.string(),
  sampleId: z.string(),
  caseId: z.string(),
  repetition: z.number().int().positive(),
  warmup: z.boolean(),
  startedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  monotonic: z.literal(true),
  rawSubmission: SearchSlotsSchema.nullable(),
  validatedSlots: SearchSlotsSchema.nullable(),
  actualGaps: z.array(ExpectedGapSchema),
  trace: z.object({
    finishReason: z.string(),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative().optional(),
        outputTokens: z.number().int().nonnegative().optional(),
        totalTokens: z.number().int().nonnegative().optional(),
      })
      .optional(),
    toolCalls: z.array(ToolTraceSchema),
    promptChars: z.number().int().nonnegative(),
    retrieval: z.object({
      domains: z.array(z.string()),
      confidence: z.number(),
      cardCount: z.number().int().nonnegative(),
      fragmentCount: z.number().int().nonnegative(),
      catalogCount: z.number().int().nonnegative(),
      contextChars: z.number().int().nonnegative(),
    }),
    missingSubmitFallback: z.boolean(),
  }),
  score: ScoreSchema,
  telemetry: z.object({
    peakRssBytes: z.number().nonnegative().nullable(),
    peakVramBytes: z.number().nonnegative().nullable(),
    peakGpuUtilizationPercent: z.number().min(0).max(100).nullable(),
    peakGpuTemperatureC: z.number().nullable(),
    peakGpuPowerW: z.number().nonnegative().nullable(),
    cpuTimeMs: z.number().nonnegative().nullable(),
    readBytes: z.number().nonnegative().nullable(),
    writeBytes: z.number().nonnegative().nullable(),
    swapGrowthBytes: z.number().nonnegative().nullable(),
    competingGpuLoad: z.boolean().nullable(),
  }),
  comparable: z.boolean(),
  diagnostic: DiagnosticSchema,
  /**
   * Set when the request never completed (timeout, refused connection, HTTP
   * error). Kept separate from `diagnostic.protocolErrors`: a broken endpoint
   * says nothing about the model's protocol conformance, and merging the two
   * reported infrastructure flakiness as a model failure.
   */
  transportError: z.string().optional(),
  error: z.string().optional(),
})
export type EvaluationSample = z.infer<typeof SampleSchema>

/**
 * A rate over measured samples, or `null` when there were none to measure.
 * An earlier revision returned 1 for an empty set, which reported a slice
 * with no data as a perfect score — enough to pass a gate on absent evidence.
 */
const RateSchema = z.number().min(0).max(1).nullable()

export const SummarySchema = z.object({
  schemaVersion: z.literal(EVALUATION_SCHEMA_VERSION),
  runId: z.string(),
  candidateId: z.string(),
  profile: ProfileNameSchema,
  suite: z.enum(['envited-x', 'toyverse']),
  cases: z.number().int().nonnegative(),
  measuredSamples: z.number().int().nonnegative(),
  metrics: z.object({
    submissionRate: RateSchema,
    rawExact: RateSchema,
    validatedExact: RateSchema,
    fieldPrecision: RateSchema,
    fieldRecall: RateSchema,
    gapPrecision: RateSchema,
    gapRecall: RateSchema,
    referenceTopologyAccuracy: RateSchema,
    lookupEfficiency: RateSchema,
    fallbackRate: RateSchema,
    compilationValidity: RateSchema,
    latencyMs: z.object({
      p50: z.number().nonnegative().nullable(),
      p95: z.number().nonnegative().nullable(),
      mad: z.number().nonnegative().nullable(),
    }),
    tokens: z.object({
      inputMedian: z.number().nonnegative().nullable(),
      outputMedian: z.number().nonnegative().nullable(),
    }),
    peakRamBytes: z.number().nonnegative().nullable(),
    peakVramBytes: z.number().nonnegative().nullable(),
    categoryValidatedExact: z.record(z.string(), RateSchema),
    localeValidatedExact: z.record(z.string(), RateSchema),
    inventedIdentifierCount: z.number().int().nonnegative(),
  }),
  gates: z.object({
    protocol: z.boolean().nullable(),
    quality: z.boolean().nullable(),
    passing: z.boolean(),
    failures: z.array(z.string()),
  }),
  comparablePerformance: z.boolean(),
  capacity: z
    .object({
      status: z.enum(['passed', 'failed', 'not-supported']),
      targetTokens: z.number().int().positive(),
      promptTokens: z.number().int().positive().optional(),
      reason: z.string().optional(),
    })
    .optional(),
})
export type EvaluationSummary = z.infer<typeof SummarySchema>

/**
 * The configuration every ranked artifact must share for its numbers to be
 * comparable. Checked against the policy that actually ran, so a divergence
 * fails the run instead of being silently recorded as conformant.
 */
export const HELD_CONSTANT_POLICY = {
  contextTokens: 65_536,
  temperature: 0,
  concurrency: 1,
  maxAgentSteps: 3,
} as const

export function assertHeldConstantPolicy(policy: RunManifest['policy']): void {
  const drift = Object.entries(HELD_CONSTANT_POLICY).flatMap(([key, expected]) => {
    const actual = policy[key as keyof typeof HELD_CONSTANT_POLICY]
    return actual === expected ? [] : [`${key}: expected ${expected}, got ${String(actual)}`]
  })
  if (drift.length > 0) {
    throw new Error(
      `Evaluation policy diverges from the held-constant contract, so this run is not ` +
        `comparable with others:\n${drift.map((line) => `  - ${line}`).join('\n')}`
    )
  }
}
