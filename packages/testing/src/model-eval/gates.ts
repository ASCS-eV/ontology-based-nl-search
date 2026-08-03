import type { z } from 'zod'

import { candidateInventory } from './candidates.js'
import type {
  Candidate,
  EvaluationSample,
  EvaluationSummary,
  GoldCase,
  ProfileNameSchema,
} from './types.js'
import { EVALUATION_SCHEMA_VERSION } from './types.js'

type ProfileName = z.infer<typeof ProfileNameSchema>

export const CRITICAL_CATEGORIES = [
  'enum',
  'range',
  'geography',
  'multi-domain',
  'reference-flat',
  'reference-scoped',
  'reference-nested',
  'gap',
  'iri',
  'injection',
  'multilingual',
] as const

export function aggregateSummary(input: {
  runId: string
  candidateId: string
  profile: ProfileName
  samples: EvaluationSample[]
  cases: GoldCase[]
}): EvaluationSummary {
  const measured = input.samples.filter((sample) => !sample.warmup)
  const caseById = new Map(input.cases.map((gold) => [gold.id, gold]))
  const count = measured.length
  const sum = (select: (sample: EvaluationSample) => number): number =>
    measured.reduce((total, sample) => total + select(sample), 0)
  const ratio = (numerator: number, denominator: number): number =>
    denominator === 0 ? 1 : numerator / denominator
  const mean = (values: number[]): number =>
    values.length === 0 ? 1 : values.reduce((left, right) => left + right, 0) / values.length

  const tp = sum((sample) => sample.score.fieldTruePositive)
  const fp = sum((sample) => sample.score.fieldFalsePositive)
  const fn = sum((sample) => sample.score.fieldFalseNegative)
  const gapTp = sum((sample) => sample.score.gapTruePositive)
  const gapFp = sum((sample) => sample.score.gapFalsePositive)
  const gapFn = sum((sample) => sample.score.gapFalseNegative)

  const categoryValidatedExact = Object.fromEntries(
    [...new Set(input.cases.flatMap((gold) => gold.categories))].sort().map((category) => {
      const selected = measured.filter((sample) =>
        caseById.get(sample.caseId)?.categories.includes(category)
      )
      return [category, mean(selected.map((sample) => Number(sample.score.validatedExact)))]
    })
  )
  const localeValidatedExact = Object.fromEntries(
    (['en', 'de', 'fr', 'ja'] as const).map((locale) => {
      const selected = measured.filter((sample) => caseById.get(sample.caseId)?.locale === locale)
      return [locale, mean(selected.map((sample) => Number(sample.score.validatedExact)))]
    })
  )

  const latencyDurations = measured
    .filter((sample) => !isPerformanceProfile(input.profile) || sample.comparable)
    .map((sample) => sample.durationMs)
  const inputTokens = measured.flatMap((sample) =>
    sample.trace.usage?.inputTokens === undefined ? [] : [sample.trace.usage.inputTokens]
  )
  const outputTokens = measured.flatMap((sample) =>
    sample.trace.usage?.outputTokens === undefined ? [] : [sample.trace.usage.outputTokens]
  )
  const inventedIdentifierCount = measured.reduce(
    (total, sample) => total + sample.diagnostic.inventedIdentifiers.length,
    0
  )

  const metrics: EvaluationSummary['metrics'] = {
    submissionRate: ratio(
      measured.filter((sample) => !sample.trace.missingSubmitFallback).length,
      count
    ),
    rawExact: ratio(measured.filter((sample) => sample.score.rawExact).length, count),
    validatedExact: ratio(measured.filter((sample) => sample.score.validatedExact).length, count),
    fieldPrecision: ratio(tp, tp + fp),
    fieldRecall: ratio(tp, tp + fn),
    gapPrecision: ratio(gapTp, gapTp + gapFp),
    gapRecall: ratio(gapTp, gapTp + gapFn),
    referenceTopologyAccuracy: ratio(
      measured.filter((sample) => sample.score.referenceTopologyExact).length,
      count
    ),
    lookupEfficiency: mean(
      measured.map((sample) => {
        const policy = caseById.get(sample.caseId)?.toolPolicy
        if (!policy || !sample.score.requiredLookupsSatisfied) return 0
        if (sample.score.lookupCount > policy.maxLookups) return 0
        return 1 - sample.score.lookupCount / (policy.maxLookups + 1)
      })
    ),
    fallbackRate: ratio(
      measured.filter((sample) => sample.trace.missingSubmitFallback).length,
      count
    ),
    compilationValidity: ratio(
      measured.filter((sample) => sample.score.compilationValid).length,
      count
    ),
    latencyMs: {
      p50: percentile(latencyDurations, 0.5),
      p95: percentile(latencyDurations, 0.95),
      mad: mad(latencyDurations),
    },
    tokens: {
      inputMedian: percentile(inputTokens, 0.5),
      outputMedian: percentile(outputTokens, 0.5),
    },
    peakRamBytes: maxNullable(measured.map((sample) => sample.telemetry.peakRssBytes)),
    peakVramBytes: maxNullable(measured.map((sample) => sample.telemetry.peakVramBytes)),
    categoryValidatedExact,
    localeValidatedExact,
    inventedIdentifierCount,
  }

  const gates = evaluateGates(input.profile, measured, metrics)
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId: input.runId,
    candidateId: input.candidateId,
    profile: input.profile,
    cases: input.cases.length,
    measuredSamples: count,
    metrics,
    gates,
    comparablePerformance:
      !isPerformanceProfile(input.profile) || measured.every((sample) => sample.comparable),
  }
}

function evaluateGates(
  profile: ProfileName,
  samples: EvaluationSample[],
  metrics: EvaluationSummary['metrics']
): EvaluationSummary['gates'] {
  const failures: string[] = []
  let protocol: boolean | null = null
  let quality: boolean | null = null

  if (profile === 'protocol') {
    if (samples.some((sample) => sample.diagnostic.protocolErrors.length > 0)) {
      failures.push('Protocol produced unknown or schema-invalid tool calls')
    }
    if (samples.some((sample) => sample.trace.missingSubmitFallback)) {
      failures.push('Protocol did not complete submit_slots within three steps')
    }
    protocol = failures.length === 0
  }

  if (profile === 'quality') {
    if (metrics.submissionRate < 0.99) failures.push('Submission rate is below 99%')
    if (metrics.validatedExact < 0.9) failures.push('Validated exact-slot accuracy is below 90%')
    for (const category of CRITICAL_CATEGORIES) {
      const score = metrics.categoryValidatedExact[category]
      if (score === undefined) {
        failures.push(`Critical category "${category}" is absent from the quality corpus`)
      } else if (score < 0.85) {
        failures.push(`Critical category "${category}" is below 85%`)
      }
    }
    if (metrics.inventedIdentifierCount > 0) {
      failures.push('A validated response retained an invented ontology identifier')
    }
    const english = metrics.localeValidatedExact['en']
    const german = metrics.localeValidatedExact['de']
    if (english !== undefined && german !== undefined && Math.abs(english - german) > 0.05) {
      failures.push('English/German validated accuracy differs by more than five points')
    }
    quality = failures.length === 0
  }

  if (isPerformanceProfile(profile) && samples.some((sample) => !sample.comparable)) {
    failures.push('Requested performance run contains incomparable samples')
  }

  return {
    protocol,
    quality,
    passing: failures.length === 0,
    failures,
  }
}

export interface TierWinner {
  tier: '16' | '24' | '32-48'
  candidateId: string
  validatedExact: number
  weightEstimateGiB: number
}

export function selectTierWinners(summaries: EvaluationSummary[]): TierWinner[] {
  const incomparable = summaries.filter(
    (summary) => isPerformanceProfile(summary.profile) && !summary.comparablePerformance
  )
  if (incomparable.length > 0) {
    throw new Error(
      `Incomparable requested performance runs: ${incomparable.map((summary) => summary.runId).join(', ')}`
    )
  }
  const candidateById = new Map(
    candidateInventory.candidates.map((candidate) => [candidate.id, candidate])
  )
  return (['16', '24', '32-48'] as const).map((tier) => {
    const eligible = summaries
      .filter((summary) => summary.profile === 'quality' && summary.gates.quality === true)
      .map((summary) => ({ summary, candidate: candidateById.get(summary.candidateId) }))
      .filter(
        (entry): entry is { summary: EvaluationSummary; candidate: Candidate } =>
          entry.candidate !== undefined && tierRank(entry.candidate.hardwareTier) <= tierRank(tier)
      )
    if (eligible.length === 0) throw new Error(`No passing candidate for ${tier} GiB tier`)
    const best = Math.max(...eligible.map((entry) => entry.summary.metrics.validatedExact))
    const shortlist = eligible.filter(
      (entry) => best - entry.summary.metrics.validatedExact <= 0.02 + Number.EPSILON
    )
    shortlist.sort(
      (left, right) =>
        left.candidate.weightEstimateGiB - right.candidate.weightEstimateGiB ||
        right.summary.metrics.validatedExact - left.summary.metrics.validatedExact ||
        left.candidate.id.localeCompare(right.candidate.id)
    )
    const winner = shortlist[0]!
    return {
      tier,
      candidateId: winner.candidate.id,
      validatedExact: winner.summary.metrics.validatedExact,
      weightEstimateGiB: winner.candidate.weightEstimateGiB,
    }
  })
}

function isPerformanceProfile(profile: ProfileName): boolean {
  return profile === 'warm-performance' || profile === 'cold-load'
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.ceil(quantile * sorted.length) - 1
  return sorted[Math.max(0, index)]!
}

function mad(values: number[]): number | null {
  const median = percentile(values, 0.5)
  return median === null
    ? null
    : percentile(
        values.map((value) => Math.abs(value - median)),
        0.5
      )
}

function maxNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length === 0 ? null : Math.max(...present)
}

function tierRank(tier: Candidate['hardwareTier']): number {
  return { '16': 1, '24': 2, '32-48': 3 }[tier]
}
