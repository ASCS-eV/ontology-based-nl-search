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

const StringValuesSchema = z.union([z.string(), z.array(z.string())])
const RangeSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((value) => value.min !== undefined || value.max !== undefined, {
    message: 'A range requires min or max',
  })

export type ReferenceSlots = {
  domain: string
  filters?: Record<string, string | string[]>
  ranges?: Record<string, { min?: number; max?: number }>
  references?: ReferenceSlots[]
}

export const ReferenceSlotsSchema: z.ZodType<ReferenceSlots> = z.lazy(() =>
  z.object({
    domain: z.string().min(1),
    filters: z.record(z.string(), StringValuesSchema).optional(),
    ranges: z.record(z.string(), RangeSchema).optional(),
    references: z.array(ReferenceSlotsSchema).optional(),
  })
)

export const SearchSlotsSchema = z.object({
  domains: z.array(z.string()).default([]),
  filters: z.record(z.string(), StringValuesSchema).default({}),
  ranges: z.record(z.string(), RangeSchema).default({}),
  references: z.union([ReferenceSlotsSchema, z.array(ReferenceSlotsSchema)]).optional(),
})
export type EvaluationSearchSlots = z.infer<typeof SearchSlotsSchema>

export const ExpectedGapSchema = z.object({
  term: z.string().min(1),
  kind: z
    .enum(['missing-domain', 'missing-property', 'missing-value', 'ambiguous', 'unsupported'])
    .optional(),
})

export const ToolPolicySchema = z.object({
  allowed: z
    .array(z.enum(['find_terms', 'describe_shape', 'list_values', 'probe_data']))
    .default([]),
  required: z
    .array(z.enum(['find_terms', 'describe_shape', 'list_values', 'probe_data']))
    .default([]),
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
  policy: z.object({
    contextTokens: z.literal(65_536),
    temperature: z.literal(0),
    concurrency: z.literal(1),
    maxAgentSteps: z.literal(3),
    lookupTools: z.array(z.string()).length(4),
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
  error: z.string().optional(),
})
export type EvaluationSample = z.infer<typeof SampleSchema>

export const SummarySchema = z.object({
  schemaVersion: z.literal(EVALUATION_SCHEMA_VERSION),
  runId: z.string(),
  candidateId: z.string(),
  profile: ProfileNameSchema,
  cases: z.number().int().nonnegative(),
  measuredSamples: z.number().int().nonnegative(),
  metrics: z.object({
    submissionRate: z.number().min(0).max(1),
    rawExact: z.number().min(0).max(1),
    validatedExact: z.number().min(0).max(1),
    fieldPrecision: z.number().min(0).max(1),
    fieldRecall: z.number().min(0).max(1),
    gapPrecision: z.number().min(0).max(1),
    gapRecall: z.number().min(0).max(1),
    referenceTopologyAccuracy: z.number().min(0).max(1),
    lookupEfficiency: z.number().min(0).max(1),
    fallbackRate: z.number().min(0).max(1),
    compilationValidity: z.number().min(0).max(1),
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
    categoryValidatedExact: z.record(z.string(), z.number().min(0).max(1)),
    localeValidatedExact: z.record(z.string(), z.number().min(0).max(1)),
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
