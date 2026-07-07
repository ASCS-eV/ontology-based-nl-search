/**
 * Retrieval accuracy gate against the shipped ontology set.
 *
 * Gating cases (queries phrased with schema terminology) must route and
 * select perfectly; diagnostic cases (synonym phrasings) are printed for
 * inspection but never fail the build. Run standalone via
 * `pnpm run eval:retrieval` for the full table.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

import { ENVITED_EVAL_CASES } from '../cases-envited.js'
import { type EvalSummary, evaluateRetrieval } from '../retrieval-eval.js'

function findRepoRoot(start: string): string {
  let cur = start
  while (cur !== '/') {
    if (existsSync(join(cur, 'pnpm-workspace.yaml'))) return cur
    cur = dirname(cur)
  }
  throw new Error(`Could not find pnpm-workspace.yaml above ${start}`)
}

let summary: EvalSummary

beforeAll(async () => {
  process.env['ONTOLOGY_ROOT'] = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
  const { resetConfig } = await import('@ontology-search/core/config')
  resetConfig()

  const { getInitializedStore, retrieveRelevantSchema, warmupRetrievalIndex } =
    await import('@ontology-search/search')
  const store = await getInitializedStore()
  await warmupRetrievalIndex(store)

  summary = await evaluateRetrieval(
    (query) => retrieveRelevantSchema(store, query),
    ENVITED_EVAL_CASES
  )
  console.warn(`\nRetrieval eval (${summary.gating.cases} gating cases)\n${summary.table}\n`)
}, 180_000)

describe('retrieval accuracy gate', () => {
  it('selects every expected property for every gating case (card recall = 1)', () => {
    for (const result of summary.results.filter((r) => r.gating)) {
      expect(result.missingProperties, `${result.name}: "${result.query}"`).toEqual([])
    }
  })

  it('routes every gating case with an asserted domain correctly', () => {
    for (const result of summary.results.filter((r) => r.gating)) {
      expect(result.domainRecall, `${result.name}: "${result.query}"`).toBe(1)
    }
  })

  it('keeps the retrieved context bounded for every gating case', () => {
    expect(summary.gating.maxContextChars).toBeLessThan(40_000)
  })

  it('separates schema-term queries from the nonsense band', () => {
    // Confidence is a mean over query tokens, so filler words dilute it —
    // "maps with motorway sections" scores ~0.33 while pure nonsense stays
    // below 0.2 (pinned in the retrieval suite). The gate asserts the
    // separation, not an absolute strength.
    for (const result of summary.results.filter((r) => r.gating)) {
      expect(result.confidence, `${result.name}: "${result.query}"`).toBeGreaterThanOrEqual(0.3)
    }
  })
})
