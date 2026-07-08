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

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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
const prevOntologyRoot = process.env['ONTOLOGY_ROOT']

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

afterAll(async () => {
  // Restore env so a sibling suite sharing the process (were isolation ever
  // relaxed) doesn't inherit this suite's ONTOLOGY_ROOT.
  if (prevOntologyRoot === undefined) delete process.env['ONTOLOGY_ROOT']
  else process.env['ONTOLOGY_ROOT'] = prevOntologyRoot
  const { resetConfig } = await import('@ontology-search/core/config')
  resetConfig()
})

describe('retrieval accuracy gate', () => {
  it('enforces a non-empty set of gating cases (guards against a vacuous gate)', () => {
    // Every gate below iterates `results.filter(r => r.gating)`; with zero
    // gating cases they would all pass vacuously. Pin that the gate has teeth.
    expect(summary.results.filter((r) => r.gating).length).toBeGreaterThan(0)
  })

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
    // The service-characteristics / ISO-34503 ontology refresh enlarged
    // individual shapes and added cross-domain references, so a gating case's
    // retrieved context grew from ~19k to ~63k chars — still an order of
    // magnitude under a whole-file SHACL dump (~300k). Boundedness, not a
    // specific size, is what's pinned; the threshold keeps headroom.
    expect(summary.gating.maxContextChars).toBeLessThan(80_000)
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
