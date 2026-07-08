/**
 * Ontology-parameterized retrieval eval harness.
 *
 * Measures how well `retrieveRelevantSchema` serves a fixture set of
 * `{ query, expectedDomains, expectedProperties }` cases authored against
 * whatever ontology is loaded. The harness itself is fully generic — every
 * ontology-specific name lives in the case fixtures, never here.
 *
 * Metrics per case: domain routing recall/precision, card recall (did the
 * needed property survive selection?), retrieved-context size, retrieval
 * confidence, and wall-clock duration. Cases marked `gating: false` are
 * reported for diagnosis (e.g. synonym-heavy phrasings the lexical ranker
 * is not expected to resolve) but excluded from threshold assertions.
 */
import type { RetrievedSchema } from '@ontology-search/search'

export interface EvalCase {
  name: string
  query: string
  /** Domains that must be routed. Empty = domain routing not asserted. */
  expectedDomains: string[]
  /** Property local names that must survive card selection. */
  expectedProperties: string[]
  /** false = report-only diagnostic, excluded from thresholds. */
  gating: boolean
}

export interface CaseResult {
  name: string
  query: string
  gating: boolean
  routedDomains: string[]
  /** 1 when the case asserts no domains. */
  domainRecall: number
  /** 1 when the case asserts no domains. */
  domainPrecision: number
  cardRecall: number
  missingProperties: string[]
  /** Size of the retrieved schema context (fragments + catalog), in chars. */
  contextChars: number
  confidence: number
  durationMs: number
}

export interface EvalGatingSummary {
  cases: number
  meanDomainRecall: number
  meanDomainPrecision: number
  meanCardRecall: number
  maxContextChars: number
}

export interface EvalSummary {
  results: CaseResult[]
  gating: EvalGatingSummary
  /** Fixed-width report table for humans. */
  table: string
}

export type RetrieveFn = (query: string) => Promise<RetrievedSchema>

/** Run every case through the retriever and aggregate the gating metrics. */
export async function evaluateRetrieval(
  retrieve: RetrieveFn,
  cases: EvalCase[]
): Promise<EvalSummary> {
  const results: CaseResult[] = []
  for (const evalCase of cases) {
    results.push(await runCase(retrieve, evalCase))
  }

  const gatingResults = results.filter((r) => r.gating)
  const mean = (xs: number[]): number =>
    xs.length === 0 ? 1 : xs.reduce((a, b) => a + b, 0) / xs.length

  const gating: EvalGatingSummary = {
    cases: gatingResults.length,
    meanDomainRecall: mean(gatingResults.map((r) => r.domainRecall)),
    meanDomainPrecision: mean(gatingResults.map((r) => r.domainPrecision)),
    meanCardRecall: mean(gatingResults.map((r) => r.cardRecall)),
    maxContextChars: Math.max(0, ...gatingResults.map((r) => r.contextChars)),
  }

  return { results, gating, table: renderTable(results) }
}

async function runCase(retrieve: RetrieveFn, evalCase: EvalCase): Promise<CaseResult> {
  const startedAt = Date.now()
  const retrieved = await retrieve(evalCase.query)
  const durationMs = Date.now() - startedAt

  const routed = new Set(retrieved.domains)
  const [domainRecall, domainPrecision] = evalCase.expectedDomains.length
    ? [
        evalCase.expectedDomains.filter((d) => routed.has(d)).length /
          evalCase.expectedDomains.length,
        retrieved.domains.length === 0
          ? 0
          : retrieved.domains.filter((d) => evalCase.expectedDomains.includes(d)).length /
            retrieved.domains.length,
      ]
    : [1, 1]

  const selectedNames = new Set(
    retrieved.cards.filter((c) => c.kind === 'property').map((c) => c.localName)
  )
  const missingProperties = evalCase.expectedProperties.filter((p) => !selectedNames.has(p))
  const cardRecall = evalCase.expectedProperties.length
    ? (evalCase.expectedProperties.length - missingProperties.length) /
      evalCase.expectedProperties.length
    : 1

  const contextChars =
    retrieved.fragments.reduce((sum, f) => sum + f.turtle.length, 0) +
    retrieved.catalog.reduce(
      (sum, d) =>
        sum + d.domain.length + d.classLabels.join(' ').length + d.sampleTerms.join(' ').length,
      0
    )

  return {
    name: evalCase.name,
    query: evalCase.query,
    gating: evalCase.gating,
    routedDomains: retrieved.domains,
    domainRecall,
    domainPrecision,
    cardRecall,
    missingProperties,
    contextChars,
    confidence: retrieved.confidence,
    durationMs,
  }
}

function renderTable(results: CaseResult[]): string {
  const header = ['case', 'gate', 'dR', 'dP', 'cR', 'conf', 'ctxKB', 'ms', 'routed / missing']
  const rows = results.map((r) => [
    r.name,
    r.gating ? 'yes' : 'no',
    r.domainRecall.toFixed(2),
    r.domainPrecision.toFixed(2),
    r.cardRecall.toFixed(2),
    r.confidence.toFixed(2),
    (r.contextChars / 1024).toFixed(1),
    String(r.durationMs),
    `${r.routedDomains.join(',')}${r.missingProperties.length ? ` / missing: ${r.missingProperties.join(',')}` : ''}`,
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)))
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ')
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n')
}
