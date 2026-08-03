import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import {
  type EvaluationSample,
  type EvaluationSummary,
  type RunManifest,
  RunManifestSchema,
  SampleSchema,
  SummarySchema,
} from './types.js'

export interface RunArtifacts {
  directory: string
  manifestPath: string
  samplesPath: string
  summaryPath: string
  reportPath: string
}

export function createRunArtifacts(repoRoot: string, runId: string): RunArtifacts {
  const directory = resolve(repoRoot, '.playground', 'eval-runs', runId)
  mkdirSync(dirname(directory), { recursive: true })
  mkdirSync(directory)
  const artifacts = {
    directory,
    manifestPath: join(directory, 'manifest.json'),
    samplesPath: join(directory, 'samples.ndjson'),
    summaryPath: join(directory, 'summary.json'),
    reportPath: join(directory, 'report.md'),
  }
  writeFileSync(artifacts.samplesPath, '', { flag: 'wx' })
  return artifacts
}

export function writeManifest(path: string, manifest: RunManifest): void {
  writeJson(path, RunManifestSchema.parse(manifest))
}

export function appendSample(path: string, sample: EvaluationSample): void {
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, `${JSON.stringify(SampleSchema.parse(sample))}\n`)
}

export function writeSummaryArtifacts(artifacts: RunArtifacts, summary: EvaluationSummary): void {
  const parsed = SummarySchema.parse(summary)
  writeJson(artifacts.summaryPath, parsed)
  writeFileSync(artifacts.reportPath, renderReport(parsed))
}

export function readSamplesNdjson(path: string): EvaluationSample[] {
  const text = readFileSync(path, 'utf8')
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return []
    try {
      return [SampleSchema.parse(JSON.parse(line))]
    } catch (error) {
      throw new Error(`Malformed evaluation NDJSON at ${path}:${index + 1}`, {
        cause: error,
      })
    }
  })
}

export function readSummary(pathOrDirectory: string): EvaluationSummary {
  const path = pathOrDirectory.endsWith('.json')
    ? pathOrDirectory
    : join(pathOrDirectory, 'summary.json')
  return SummarySchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

export function redactEndpoint(value: string): string {
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/key|token|secret|auth/i.test(key)) url.searchParams.set(key, '[REDACTED]')
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return '[invalid endpoint]'
  }
}

export function redactSecrets(values: string[]): string[] {
  return values.map((value, index) =>
    index > 0 && /^--?(?:api[-_]?key|token|secret|authorization)$/i.test(values[index - 1] ?? '')
      ? '[REDACTED]'
      : value.replace(/((?:api[-_]?key|token|secret|authorization)=)[^\s]+/gi, '$1[REDACTED]')
  )
}

function renderReport(summary: EvaluationSummary): string {
  const percent = (value: number): string => `${(value * 100).toFixed(1)}%`
  const bytes = (value: number | null): string =>
    value === null ? 'not collected' : `${(value / 1024 ** 3).toFixed(2)} GiB`
  const latency = summary.metrics.latencyMs
  const tokens = summary.metrics.tokens
  const capacity = summary.capacity
    ? `\n## Capacity\n\n- Status: **${summary.capacity.status}**\n- Target / verified prompt tokens: ${summary.capacity.targetTokens} / ${summary.capacity.promptTokens ?? 'not available'}\n${summary.capacity.reason ? `- Reason: ${summary.capacity.reason}\n` : ''}`
    : ''
  const categoryRows = Object.entries(summary.metrics.categoryValidatedExact)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `| ${name} | ${percent(value)} |`)
    .join('\n')
  const localeRows = Object.entries(summary.metrics.localeValidatedExact)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `| ${name} | ${percent(value)} |`)
    .join('\n')
  return `# Local model evaluation: ${summary.candidateId}

- Run: \`${summary.runId}\`
- Profile: \`${summary.profile}\`
- Gate: **${summary.gates.passing ? 'PASS' : 'FAIL'}**
- Cases / measured samples: ${summary.cases} / ${summary.measuredSamples}

## Semantic quality

| Metric | Result |
| --- | ---: |
| Submission success | ${percent(summary.metrics.submissionRate)} |
| Raw exact slots | ${percent(summary.metrics.rawExact)} |
| Validated exact slots | ${percent(summary.metrics.validatedExact)} |
| Field precision / recall | ${percent(summary.metrics.fieldPrecision)} / ${percent(summary.metrics.fieldRecall)} |
| Gap precision / recall | ${percent(summary.metrics.gapPrecision)} / ${percent(summary.metrics.gapRecall)} |
| Reference topology | ${percent(summary.metrics.referenceTopologyAccuracy)} |
| Lookup efficiency | ${percent(summary.metrics.lookupEfficiency)} |
| Compilation validity | ${percent(summary.metrics.compilationValidity)} |
| Fallback rate | ${percent(summary.metrics.fallbackRate)} |

## Performance and capacity

| Metric | Result |
| --- | ---: |
| Latency p50 / p95 / MAD | ${latency.p50 ?? 'n/a'} / ${latency.p95 ?? 'n/a'} / ${latency.mad ?? 'n/a'} ms |
| Input / output tokens (median) | ${tokens.inputMedian ?? 'not reported'} / ${tokens.outputMedian ?? 'not reported'} |
| Peak RAM | ${bytes(summary.metrics.peakRamBytes)} |
| Peak VRAM | ${bytes(summary.metrics.peakVramBytes)} |
| Comparable | ${summary.comparablePerformance ? 'yes' : 'no'} |
${capacity}

## Validated exactness by slice

| Category | Result |
| --- | ---: |
${categoryRows || '| No category samples | n/a |'}

| Locale | Result |
| --- | ---: |
${localeRows || '| No locale samples | n/a |'}

- Invented ontology identifiers retained after validation: ${summary.metrics.inventedIdentifierCount}

## Gate diagnostics

${summary.gates.failures.length === 0 ? '- None.' : summary.gates.failures.map((failure) => `- ${failure}`).join('\n')}

Generated results are local evidence for this run only. The repository does not commit benchmark results or model weights.
`
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)])
    )
  }
  return value
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
