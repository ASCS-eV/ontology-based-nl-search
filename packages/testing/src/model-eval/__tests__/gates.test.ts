import { describe, expect, it } from 'vitest'

import { aggregateSummary, CRITICAL_CATEGORIES, selectTierWinners } from '../gates.js'
import {
  EVALUATION_SCHEMA_VERSION,
  type EvaluationSample,
  GoldCaseSchema,
  SampleSchema,
} from '../types.js'

function makeGold(category: string, index: number) {
  return GoldCaseSchema.parse({
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    id: `gate-${String(index).padStart(3, '0')}`,
    suite: 'envited-x',
    locale: index % 2 === 0 ? 'en' : 'de',
    query: category,
    expected: { slots: { domains: [], filters: {}, ranges: {} }, gaps: [] },
    categories: [category],
    risk: 'normal',
    toolPolicy: {
      allowed: [],
      required: [],
      maxLookups: 0,
      directSubmissionAllowed: true,
    },
  })
}

function makeSample(caseId: string, exact = true): EvaluationSample {
  return SampleSchema.parse({
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId: 'run',
    sampleId: `${caseId}-r1`,
    caseId,
    repetition: 1,
    warmup: false,
    startedAt: '2026-08-03T08:00:00.000Z',
    durationMs: 100,
    monotonic: true,
    rawSubmission: { domains: [], filters: {}, ranges: {} },
    validatedSlots: { domains: [], filters: {}, ranges: {} },
    actualGaps: [],
    trace: {
      finishReason: 'tool-calls',
      toolCalls: [{ step: 0, toolName: 'submit_slots', output: {} }],
      promptChars: 1000,
      retrieval: {
        domains: [],
        confidence: 1,
        cardCount: 1,
        fragmentCount: 1,
        catalogCount: 1,
        contextChars: 100,
      },
      missingSubmitFallback: false,
    },
    score: {
      rawExact: exact,
      validatedExact: exact,
      fieldTruePositive: 0,
      fieldFalsePositive: exact ? 0 : 1,
      fieldFalseNegative: 0,
      gapTruePositive: 0,
      gapFalsePositive: 0,
      gapFalseNegative: 0,
      referenceTopologyExact: exact,
      lookupCount: 0,
      requiredLookupsSatisfied: true,
      compilationValid: true,
    },
    telemetry: {
      peakRssBytes: 1024,
      peakVramBytes: 2048,
      peakGpuUtilizationPercent: 10,
      peakGpuTemperatureC: 50,
      peakGpuPowerW: 100,
      cpuTimeMs: 10,
      readBytes: 0,
      writeBytes: 0,
      swapGrowthBytes: 0,
      competingGpuLoad: false,
    },
    comparable: true,
    diagnostic: {
      protocolErrors: [],
      inventedIdentifiers: [],
      comparabilityReasons: [],
      samplingCoverage: { processTree: 'complete', gpu: 'complete', samples: 1 },
    },
  })
}

describe('evaluation gates', () => {
  it('passes a quality aggregate only when every critical category is represented', () => {
    const cases = CRITICAL_CATEGORIES.map(makeGold)
    const passing = aggregateSummary({
      runId: 'quality-pass',
      candidateId: 'qwen3.5-4b',
      profile: 'quality',
      cases,
      samples: cases.map((gold) => makeSample(gold.id)),
    })
    const missingCategory = aggregateSummary({
      runId: 'quality-missing',
      candidateId: 'qwen3.5-4b',
      profile: 'quality',
      cases: cases.slice(1),
      samples: cases.slice(1).map((gold) => makeSample(gold.id)),
    })

    expect(passing.gates).toMatchObject({ quality: true, passing: true })
    expect(missingCategory.gates.passing).toBe(false)
    expect(missingCategory.gates.failures).toContain(
      `Critical category "${CRITICAL_CATEGORIES[0]}" is absent from the quality corpus`
    )
  })

  it('requires protocol completion and schema-valid known tool calls', () => {
    const gold = makeGold('injection', 1)
    const sample = makeSample(gold.id)
    sample.trace.missingSubmitFallback = true
    sample.diagnostic.protocolErrors.push('Unknown tool "execute_sql"')

    const summary = aggregateSummary({
      runId: 'protocol-fail',
      candidateId: 'qwen3.5-4b',
      profile: 'protocol',
      cases: [gold],
      samples: [sample],
    })

    expect(summary.gates).toMatchObject({ protocol: false, passing: false })
    expect(summary.gates.failures).toHaveLength(2)
  })

  it('selects the smallest passing quality artifact within two points of the best', () => {
    const cases = CRITICAL_CATEGORIES.map(makeGold)
    const baseline = aggregateSummary({
      runId: 'winner',
      candidateId: 'qwen3.5-4b',
      profile: 'quality',
      cases,
      samples: cases.map((gold) => makeSample(gold.id)),
    })
    const larger = structuredClone(baseline)
    larger.runId = 'larger'
    larger.candidateId = 'gpt-oss-20b'
    larger.metrics.validatedExact = 1
    const performance = structuredClone(baseline)
    performance.runId = 'performance'
    performance.profile = 'warm-performance'
    performance.gates.quality = null

    const winners = selectTierWinners([larger, baseline, performance])
    expect(winners.map((winner) => winner.candidateId)).toEqual([
      'qwen3.5-4b',
      'qwen3.5-4b',
      'qwen3.5-4b',
    ])
    performance.comparablePerformance = false
    expect(() => selectTierWinners([larger, baseline, performance])).toThrow(
      'Incomparable requested performance runs: performance'
    )
  })
})
