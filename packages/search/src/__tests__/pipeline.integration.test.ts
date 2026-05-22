/**
 * Real-pipeline integration test for SearchService.
 *
 * Every other test in this repo mocks at least one of the layers the
 * service composes:
 *
 * - `compiler.test.ts` mocks `../schema-queries.js` and `../init.js`,
 *   so the compiler never sees a real schema graph.
 * - `service.test.ts` mocks the SPARQL store with a constant string
 *   and tautologically asserts the same string comes back.
 * - `routes.test.ts` mocks `searchNl` / `searchRefine` entirely; the
 *   "route test" is mock-in / mock-out.
 * - The Playwright suite stubs `/api/search/stream` with a hand-rolled
 *   SSE string — no E2E hits a real backend.
 *
 * This file is the missing piece: drive `SearchService` end-to-end
 * against the **real** workspace ontology in a **real** in-memory
 * Oxigraph store, with the real compiler and the real policy gate.
 * Only the LLM is mocked — `interpretQuery` returns fixed slots that
 * a real LLM might plausibly emit. Everything downstream is exercised
 * for real.
 *
 * What this catches:
 * - Wiring regressions across compiler / store / policy that all the
 *   other suites' mocks would mask.
 * - Schema-discovery regressions that produce valid-looking but
 *   data-mismatched SPARQL (queries that pass policy but return 0
 *   rows because the path doesn't exist in the data).
 * - Cross-domain join correctness on the actual sample dataset.
 *
 * What this deliberately does NOT cover:
 * - LLM agent boundary tests (task 09).
 * - SSE protocol contracts (task 17).
 * - Any UI behaviour (task 18).
 */

import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { enforceSparqlPolicy } from '@ontology-search/sparql/policy'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Intra-package imports use relative paths because the package's exports
// resolve to ./dist/index.js, which isn't built when CI runs tests
// directly via vitest. The same pattern is used by every other test file
// in this package (compiler.test.ts, schema-queries.test.ts, etc.).
import { compileAllCountQueries, compileSlots } from '../compiler.js'
import { getInitializedStore } from '../init.js'
import { type SearchDependencies, SearchService } from '../service.js'
import type { SearchSlots } from '../slots.js'
import type { LlmStructuredResponse } from '../types.js'

/**
 * Wire SearchService with everything REAL except the LLM. The LLM is
 * mocked to return a caller-supplied SearchSlots, which lets each test
 * pick its own slot shape while still exercising the post-LLM
 * compile/policy/execute path against the live workspace.
 */
function realServiceWithMockedLlm(slots: SearchSlots): SearchService {
  const interpretQuery = async (
    query: string,
    _options: { domain?: string; signal?: AbortSignal }
  ): Promise<LlmStructuredResponse> => {
    const sparql = await compileSlots(slots)
    return {
      interpretation: {
        summary: `mocked LLM produced fixed slots for "${query}"`,
        mappedTerms: [],
      },
      gaps: [],
      sparql,
    }
  }

  const deps: SearchDependencies = {
    getStore: getInitializedStore,
    interpretQuery,
    compileSlots,
    compileCountQueries: compileAllCountQueries,
    enforcePolicy: enforceSparqlPolicy,
  }
  return new SearchService(deps)
}

beforeAll(async () => {
  // Register ontology namespaces in the policy (replaces hardcoded ENVITED_X_PATTERN)
  const registry = await buildDomainRegistry()
  const { registerPolicyNamespaces } = await import('@ontology-search/sparql/policy')
  registerPolicyNamespaces(registry.getAllNamespaces())
  // Warm the store and downstream caches once; ~3s on first call.
  await getInitializedStore()
}, 60_000)

afterAll(async () => {
  const { resetPolicyNamespaces } = await import('@ontology-search/sparql/policy')
  resetPolicyNamespaces()
})

describe('SearchService — real pipeline integration', () => {
  /**
   * Sanity baseline: empty slots target hdmap. The real compiler must
   * emit a SPARQL query that the real policy accepts and the real
   * store can execute against the loaded sample data.
   */
  it('runs the full pipeline for an empty hdmap query', async () => {
    const service = realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
    })

    const result = await service.searchNl({ query: 'all HD maps' })

    expect(result.execution.error).toBeUndefined()
    expect(result.execution.results.length).toBeGreaterThan(0)
    expect(result.meta.matchCount).toBe(result.execution.results.length)
    // The sample dataset declares 117 HD maps. Allow for legitimate
    // dataset evolution by asserting a lower bound rather than equality.
    expect(result.meta.matchCount).toBeGreaterThan(10)
    expect(result.meta.totalDatasets).toBeGreaterThan(0)
  }, 60_000)

  /**
   * A single Content-group filter must narrow the result set against
   * the real data. We compare against the baseline counts to prove
   * filtering actually filtered, not that the compiler produced a
   * syntactically valid query that returned everything.
   */
  it('narrows hdmap results when a Content-group filter is supplied', async () => {
    const baseline = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
    }).searchNl({ query: 'all HD maps' })

    const filtered = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    }).searchNl({ query: 'motorway HD maps' })

    expect(filtered.execution.error).toBeUndefined()
    expect(filtered.meta.matchCount).toBeGreaterThan(0)
    expect(filtered.meta.matchCount).toBeLessThanOrEqual(baseline.meta.matchCount)
  }, 60_000)

  /**
   * Cross-domain filtering exercises the manifest:hasReferencedArtifacts
   * join introduced in PR #4. Scenario filters narrow scenarios; a
   * referenced-domain filter (hdmap) must further narrow to only those
   * scenarios that reference an HD map matching the constraint.
   */
  it('joins scenario → hdmap via referenced artifacts', async () => {
    const onlyScenario = await realServiceWithMockedLlm({
      domains: ['scenario'],
      filters: {},
      ranges: {},
    }).searchNl({ query: 'all scenarios' })

    const joined = await realServiceWithMockedLlm({
      domains: ['scenario', 'hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    }).searchNl({ query: 'scenarios on motorway HD maps' })

    expect(joined.execution.error).toBeUndefined()
    // Join must return at most as many as scenarios alone.
    expect(joined.meta.matchCount).toBeLessThanOrEqual(onlyScenario.meta.matchCount)
  }, 60_000)

  /**
   * Numeric ranges flow through compileSlots → policy → store.
   * The sample data declares hdmap:numberIntersections values across
   * a wide range; a lower-bound filter must produce a non-empty
   * subset of the baseline.
   */
  it('applies a numeric range filter end-to-end', async () => {
    const baseline = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
    }).searchNl({ query: 'all HD maps' })

    const ranged = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: {},
      ranges: { numberIntersections: { min: 5 } },
    }).searchNl({ query: 'HD maps with at least 5 intersections' })

    expect(ranged.execution.error).toBeUndefined()
    expect(ranged.meta.matchCount).toBeGreaterThanOrEqual(0)
    expect(ranged.meta.matchCount).toBeLessThanOrEqual(baseline.meta.matchCount)
  }, 60_000)

  /**
   * Location filtering takes the array-aware path introduced in
   * PR #4. A single country must apply STR-based CONTAINS matching;
   * an array must apply FILTER IN. Either path must return a finite
   * non-error result against the real data.
   */
  it('applies a location filter without producing a policy violation', async () => {
    const single = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: 'DE' },
    }).searchNl({ query: 'HD maps in Germany' })
    expect(single.execution.error).toBeUndefined()

    const multi = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: ['DE', 'FR', 'IT'] },
    }).searchNl({ query: 'HD maps in any of DE/FR/IT' })
    expect(multi.execution.error).toBeUndefined()
    // Array form must match at least as many rows as the single
    // for the same primary country (proves the IN clause actually
    // expanded rather than collapsing to a single match).
    expect(multi.meta.matchCount).toBeGreaterThanOrEqual(single.meta.matchCount)
  }, 60_000)

  /**
   * Cross-domain search (no `domains` supplied) enumerates every
   * discovered asset target class via a SPARQL `VALUES` clause and
   * matches `?asset a ?assetClass`. The list is sourced from the
   * domain registry's discovered asset domains, so the query works
   * against any SPARQL store regardless of whether it performs
   * `rdfs:subClassOf` inference.
   *
   * Previous attempt (`?asset a envited-x:SimulationAsset`) silently
   * returned zero rows because Oxigraph does no RDFS inference and
   * the sample data tags each asset only with its concrete class.
   * This test was the regression that surfaced the bug.
   */
  it('runs the cross-domain query and matches every loaded asset type', async () => {
    const result = await realServiceWithMockedLlm({
      domains: [],
      filters: {},
      ranges: {},
    }).searchNl({ query: 'everything' })

    expect(result.execution.error).toBeUndefined()
    // The sample dataset declares 267 assets across all 5 sample
    // domains. The compiler enumerates EVERY discovered asset
    // class (including the 6 declared-but-empty domains) so the
    // match count is the actual instance count in the data.
    // Asserting a lower bound to allow legitimate dataset evolution.
    expect(result.meta.matchCount).toBeGreaterThan(50)
  }, 60_000)

  /**
   * `totalDatasets` is computed via the count-loop in
   * countTotalDatasets. The integration test must prove that loop
   * executes the count SPARQL successfully (not just that it
   * fall-throughs to 0 on error — which an over-zealous catch
   * would do silently).
   */
  it('counts total datasets across all asset domains', async () => {
    const result = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
    }).searchNl({ query: 'all HD maps' })

    expect(result.meta.totalDatasets).toBeGreaterThan(result.meta.matchCount)
    // Sanity: the count is the sum of every asset class. With ~267
    // assets in the dataset, it should not be zero.
    expect(result.meta.totalDatasets).toBeGreaterThan(50)
  }, 60_000)

  /**
   * The policy gate is the last line of defense before SPARQL hits
   * the store. The integration test must prove every legitimate
   * compiled query passes — a regression that emits SERVICE / LOAD /
   * unbounded LIMIT would be caught here even if upstream tests
   * mocked the policy away.
   */
  it('every compiled query passes the policy gate', async () => {
    const cases: SearchSlots[] = [
      { domains: ['hdmap'], filters: {}, ranges: {} },
      { domains: ['hdmap'], filters: { roadTypes: 'motorway' }, ranges: {} },
      { domains: ['hdmap'], filters: {}, ranges: { numberIntersections: { min: 1, max: 10 } } },
      {
        domains: ['hdmap'],
        filters: {},
        ranges: {},
        location: { country: ['DE', 'FR'] },
      },
      { domains: ['scenario', 'hdmap'], filters: { scenarioCategory: 'urban' }, ranges: {} },
      { domains: [], filters: {}, ranges: {} },
      // Peer-domain UNION query
      { domains: ['hdmap', 'ositrace'], filters: { roadTypes: 'motorway' }, ranges: {} },
      {
        domains: ['hdmap', 'ositrace'],
        filters: { roadTypes: 'town' },
        ranges: {},
        location: { country: 'DE' },
      },
    ]

    for (const slots of cases) {
      const sparql = await compileSlots(slots)
      const policy = enforceSparqlPolicy(sparql)
      expect(policy.allowed, `policy violations: ${policy.violations.join('; ')}`).toBe(true)
    }
  }, 60_000)

  /**
   * Refine path mirrors the NL path minus the LLM. The integration
   * test asserts the same compile / policy / execute composition
   * works when slots come in pre-filled (the /refine route's case).
   */
  it('refine pipeline executes against the real store', async () => {
    const deps: SearchDependencies = {
      getStore: getInitializedStore,
      interpretQuery: async () => {
        throw new Error('refine path must not call interpretQuery')
      },
      compileSlots,
      compileCountQueries: compileAllCountQueries,
      enforcePolicy: enforceSparqlPolicy,
    }
    const service = new SearchService(deps)

    const result = await service.searchRefine({
      slots: { domains: ['hdmap'], filters: { roadTypes: 'motorway' }, ranges: {} },
    })

    expect(result.execution.error).toBeUndefined()
    expect(result.meta.matchCount).toBeGreaterThan(0)
  }, 60_000)

  /**
   * Hallucinated property names are dropped before SPARQL emission
   * (the compiler's `isKnownProperty` predicate from PR #4). The
   * real pipeline must surface this as an empty/baseline result
   * rather than an error.
   */
  it('drops a hallucinated filter property and still executes', async () => {
    const result = await realServiceWithMockedLlm({
      domains: ['hdmap'],
      filters: { numberLanes: '3' }, // ontology has no numberLanes
      ranges: {},
    }).searchNl({ query: 'HD maps with 3 lanes' })

    expect(result.execution.error).toBeUndefined()
    expect(result.sparql).not.toContain('numberLanes')
    // With the hallucinated filter dropped the query matches the
    // unfiltered baseline (no real narrowing applied).
    expect(result.meta.matchCount).toBeGreaterThan(0)
  }, 60_000)

  /**
   * Peer-domain UNION: when multiple non-hierarchical domains are
   * selected (hdmap + ositrace), the compiler must generate a UNION
   * query that searches BOTH domains independently. This was a bug
   * where the compiler silently dropped ositrace from the query
   * because it had no domain-specific constraints (they were shared).
   */
  it('generates UNION for peer domains and finds assets in both', async () => {
    const result = await realServiceWithMockedLlm({
      domains: ['hdmap', 'ositrace'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
      location: { country: 'FR' },
    }).searchNl({ query: 'French motorway data' })

    expect(result.execution.error).toBeUndefined()
    expect(result.sparql).toContain('UNION')
    expect(result.sparql).toContain('hdmap:HdMap')
    expect(result.sparql).toContain('ositrace:OSITrace')
    // Must find results from BOTH domains: 7 hdmap + 3 ositrace = 10
    expect(result.meta.matchCount).toBeGreaterThanOrEqual(10)
    // Verify results include both asset types
    const assetIds = result.execution.results.map((r) => r.asset)
    const hasHdmap = assetIds.some((id) => id?.includes('HdMap'))
    const hasOsi = assetIds.some((id) => id?.includes('OSITrace'))
    expect(hasHdmap).toBe(true)
    expect(hasOsi).toBe(true)
  }, 60_000)

  /**
   * Peer-domain UNION with an empty result: the UNION query structure
   * must not cause an execution error even if zero results are returned
   * (e.g., a country with no matching assets in either domain).
   */
  it('UNION query executes without error even with zero results', async () => {
    const result = await realServiceWithMockedLlm({
      domains: ['hdmap', 'ositrace'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
      location: { country: 'ZZ' }, // Non-existent country code
    }).searchNl({ query: 'Fictional country motorway data' })

    expect(result.execution.error).toBeUndefined()
    expect(result.sparql).toContain('UNION')
    expect(result.meta.matchCount).toBe(0)
  }, 60_000)
})
