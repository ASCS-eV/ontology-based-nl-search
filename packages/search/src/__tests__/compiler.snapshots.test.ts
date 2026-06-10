/**
 * Compiler determinism regression suite.
 *
 * The CLAUDE.md security invariant says:
 *
 *   "The compiler is deterministic — same slots always produce the same
 *    query. This is the security model: no prompt injection can produce
 *    arbitrary queries."
 *
 * The existing `compiler.test.ts` only uses `toContain` assertions on
 * substrings, which would still pass under non-deterministic ordering of
 * FILTERs, triples, or prefix declarations. This file pins the *exact*
 * SPARQL output for ~25 representative `SearchSlots` shapes and runs
 * each through `compileSlots` twice to assert string equality.
 *
 * Every emitted query is also run through `enforceSparqlPolicy` as
 * defense-in-depth: the compiler must never emit SPARQL that the
 * security gate would reject.
 *
 * Unlike `compiler.test.ts`, this file does NOT mock `schema-queries.js`
 * or `init.js` — it drives the real workspace ontology through the real
 * `getInitializedStore` pipeline. If the ontology submodule legitimately
 * changes the SPARQL output (e.g., a property is renamed), the snapshots
 * here should be regenerated deliberately, not silently auto-fixed.
 */

import { enforceSparqlPolicy, registerPolicyNamespaces } from '@ontology-search/sparql/policy'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { compileSlots, compileSlotsWithTrace } from '../compiler.js'
import { getInitializedStore } from '../init.js'
import type { SearchSlots } from '../slots.js'

beforeAll(async () => {
  // Warm the singletons once. The compiler's internal vocabulary cache plus
  // the domain registry are then re-used across every test in this file.
  await getInitializedStore()

  // Register ontology namespaces with the SPARQL policy so compiled queries
  // pass prefix validation. In production this is done during warmup.
  const { buildDomainRegistry } = await import('@ontology-search/ontology/domain-registry')
  const registry = await buildDomainRegistry()
  registerPolicyNamespaces(registry.getAllNamespaces())
}, 60_000)

/**
 * Compile twice, assert bit-identical output, assert the policy gate
 * accepts the query. Returns the SPARQL so callers can pin it to an
 * inline snapshot in the same test.
 */
async function assertDeterministic(slots: SearchSlots): Promise<string> {
  const first = await compileSlots(slots)
  const second = await compileSlots(slots)
  expect(second).toBe(first)
  const policy = enforceSparqlPolicy(first)
  expect(policy.allowed, `policy violations: ${policy.violations.join('; ')}`).toBe(true)
  return first
}

describe('compileSlots — determinism + snapshot suite', () => {
  // ─── Empty / minimal slots ─────────────────────────────────────────────

  it('empty slots with no domain → cross-domain query', async () => {
    const sparql = await assertDeterministic({ domains: [], filters: {}, ranges: {} })
    expect(sparql).toMatchSnapshot()
  })

  it('empty slots for hdmap', async () => {
    const sparql = await assertDeterministic({ domains: ['hdmap'], filters: {}, ranges: {} })
    expect(sparql).toMatchSnapshot()
  })

  it('empty slots for scenario', async () => {
    const sparql = await assertDeterministic({ domains: ['scenario'], filters: {}, ranges: {} })
    expect(sparql).toMatchSnapshot()
  })

  it('empty slots for ositrace', async () => {
    const sparql = await assertDeterministic({ domains: ['ositrace'], filters: {}, ranges: {} })
    expect(sparql).toMatchSnapshot()
  })

  // ─── Single-property filters ──────────────────────────────────────────

  it('hdmap single-value Content filter (roadTypes=motorway)', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('hdmap multi-value Content filter (roadTypes IN motorway, urban)', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { roadTypes: ['motorway', 'urban'] },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('hdmap two-property filter (roadTypes + laneTypes)', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway', laneTypes: 'driving' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('hdmap Format-group filter (formatType)', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { formatType: 'ASAM OpenDRIVE' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('scenario single Content filter (scenarioCategory)', async () => {
    const sparql = await assertDeterministic({
      domains: ['scenario'],
      filters: { scenarioCategory: 'urban' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('scenario multi-value Content filter (entityTypes IN truck, bicycle)', async () => {
    const sparql = await assertDeterministic({
      domains: ['scenario'],
      filters: { entityTypes: ['truck', 'bicycle'] },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── Numeric ranges ────────────────────────────────────────────────────

  it('hdmap numeric range — lower bound only', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: { numberIntersections: { min: 5 } },
    })
    expect(sparql).toMatchSnapshot()
  })

  it('hdmap numeric range — upper bound only', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: { numberIntersections: { max: 50 } },
    })
    expect(sparql).toMatchSnapshot()
  })

  it('hdmap numeric range — both bounds', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: { numberIntersections: { min: 5, max: 50 } },
    })
    expect(sparql).toMatchSnapshot()
  })

  it('hdmap two ranges in different shape groups', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: {
        numberIntersections: { min: 5 },
        numberTrafficLights: { max: 100 },
      },
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── Geographic filters (task 21d-flat: country/state/region/city now ordinary filters) ──

  it('country filter — single value', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { country: 'DE' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('country filter — multi-value array (FILTER IN matching)', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { country: ['DE', 'FR', 'IT'] },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('country filter — single-element array collapses to FILTER IN of one', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { country: ['DE'] },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('all four geographic fields combined as ordinary filters', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { country: 'DE', state: 'Bavaria', region: 'Oberbayern', city: 'Munich' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── License (task 21d-flat: ordinary filter keyed by `license`) ───────

  it('license filter only', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { license: 'CC-BY-4.0' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('license combined with content filter', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway', license: 'CC-BY-4.0' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── Combinations & cross-domain ──────────────────────────────────────

  it('hdmap with filter + range + country + license combined', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway', country: 'DE', license: 'CC-BY-4.0' },
      ranges: { numberIntersections: { min: 5, max: 50 } },
    })
    expect(sparql).toMatchSnapshot()
  })

  it('scenario + hdmap cross-domain (primary scenario references hdmap)', async () => {
    const sparql = await assertDeterministic({
      domains: ['scenario', 'hdmap'],
      filters: { scenarioCategory: 'urban', roadTypes: 'motorway' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  it('scenario + hdmap cross-domain with range on referenced domain', async () => {
    const sparql = await assertDeterministic({
      domains: ['scenario', 'hdmap'],
      filters: { scenarioCategory: 'urban' },
      ranges: { numberIntersections: { min: 3 } },
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── Shape-group genericity (task 07) ─────────────────────────────────

  /**
   * Regression for task 07. Pre-refactor the compiler used a switch over
   * four hardcoded group names (Content/Format/Quantity/DataSource) and
   * silently dropped any property classified into a different group. The
   * snapshot here exercises a property whose SHACL shape group is NOT one
   * of those four — and proves a `has${Group}` link predicate is emitted
   * (with the new generic variable-naming convention). If the refactor
   * regresses to a hardcoded set, this snapshot's content shifts in a way
   * that's visible at review.
   *
   * The property/group used is whatever the workspace ontology declares
   * outside the four legacy names. Today that's `accuracySignals` in the
   * `Quality` group, but the assertion is structural — the snapshot diff
   * is what matters, not the literal SPARQL substring.
   */
  it('routes a non-legacy shape group through the discovered link predicate', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { accuracySignals: '0.1' },
      ranges: {},
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── Unknown / hallucinated property names are dropped ─────────────────

  it('drops an unknown filter key and still emits a deterministic query', async () => {
    // `numberLanes` does not exist in the ontology — the compiler drops it.
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { numberLanes: '3' },
      ranges: {},
    })
    expect(sparql).not.toContain('numberLanes')
    expect(sparql).toMatchSnapshot()
  })

  it('drops an unknown range key and still emits a deterministic query', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: { numberLanes: { min: 1, max: 4 } },
    })
    expect(sparql).not.toContain('numberLanes')
    expect(sparql).toMatchSnapshot()
  })

  // ─── Empty containers vs missing ──────────────────────────────────────

  it('explicit empty filters object matches no-filters semantics', async () => {
    const a = await compileSlots({ domains: ['hdmap'], filters: {}, ranges: {} })
    const b = await compileSlots({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
    })
    expect(b).toBe(a)
  })

  // ─── Peer-domain UNION queries ────────────────────────────────────────

  it('peer domains (hdmap + ositrace) with shared roadTypes → UNION', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap', 'ositrace'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    })
    expect(sparql).toContain('UNION')
    expect(sparql).toMatchSnapshot()
  })

  it('peer domains (hdmap + ositrace) with country filter → UNION', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap', 'ositrace'],
      filters: { roadTypes: 'motorway', country: 'FR' },
      ranges: {},
    })
    expect(sparql).toContain('UNION')
    expect(sparql).toContain('country')
    expect(sparql).toMatchSnapshot()
  })

  // ─── Cross-reference JOINs (deterministic + policy-clean) ──────────────

  it('single reference → distinct-asset-limited JOIN', async () => {
    const sparql = await assertDeterministic({
      domains: ['ositrace'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap' }],
    })
    expect(sparql).toMatch(/SELECT DISTINCT \?asset WHERE \{/)
    expect(sparql).toContain('hdmap:HdMap')
    expect(sparql).toMatchSnapshot()
  })

  it('multiple references (ositrace + hdmap) → two AND-combined JOINs, both projected', async () => {
    const sparql = await assertDeterministic({
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'ositrace' }, { domain: 'hdmap' }],
    })
    // Both referenced asset classes appear (AND-combined JOINs).
    expect(sparql).toContain('ositrace:OSITrace')
    expect(sparql).toContain('hdmap:HdMap')
    // Every reference is projected so the UI can display all referenced assets:
    // the first as ?refAsset/?refName, the second as ?refAsset1/?refName1.
    expect(sparql).toMatch(/SELECT[^\n]*\?refAsset\b/)
    expect(sparql).toMatch(/SELECT[^\n]*\?refAsset1\b/)
    expect(sparql).toMatch(/SELECT[^\n]*\?refName1\b/)
    expect(sparql).toMatchSnapshot()
  })

  it('nested reference (scenario → trace → map) chains the JOIN through the trace', async () => {
    const sparql = await assertDeterministic({
      domains: ['scenario'],
      filters: {},
      ranges: {},
      // "scenarios derived from traces with maps": the map hangs off the trace,
      // not the scenario.
      references: [{ domain: 'ositrace', references: [{ domain: 'hdmap' }] }],
    })
    expect(sparql).toContain('ositrace:OSITrace')
    expect(sparql).toContain('hdmap:HdMap')
    // The trace projects as ?refAsset; the nested map as ?refAsset_0/?refName_0.
    expect(sparql).toMatch(/SELECT[^\n]*\?refAsset\b/)
    expect(sparql).toMatch(/SELECT[^\n]*\?refAsset_0\b/)
    expect(sparql).toMatch(/SELECT[^\n]*\?refName_0\b/)
    // The map JOIN must start from the trace var (?refAsset …), not ?asset —
    // that's what makes it a chain. The trace's class is bound, and a triple
    // anchored at ?refAsset reaches the map.
    expect(sparql).toMatch(/\?refAsset a ositrace:OSITrace/)
    expect(sparql).toMatch(/\?refAsset_0 a hdmap:HdMap/)
    expect(sparql).toMatchSnapshot()
  })

  it('sibling-edge fallback: ositrace referencing environment-model reuses manifest path', async () => {
    // The data index has ositrace → hdmap via manifest but NOT ositrace →
    // environment-model. The sibling-edge fallback should reuse the manifest
    // path with a different type constraint — no wildcard `(!<urn:none>)+`.
    const slots: SearchSlots = {
      domains: ['ositrace'],
      filters: {},
      ranges: {},
      references: [{ domain: 'environment-model' }],
    }
    const result = await compileSlotsWithTrace(slots)
    // Must NOT contain the wildcard property-path pattern.
    expect(result.sparql).not.toContain('(!<urn:none>)+')
    // Must use the manifest path (sibling reuse).
    expect(result.sparql).toContain('hasManifest')
    expect(result.sparql).toContain('hasReferencedArtifacts')
    // Must type-constrain the referenced asset.
    expect(result.sparql).toContain('EnvironmentModel')
    // No dropped references — sibling fallback succeeded.
    expect(result.droppedReferences).toBeUndefined()
    // Policy-clean.
    const policy = enforceSparqlPolicy(result.sparql)
    expect(policy.allowed, `policy violations: ${policy.violations.join('; ')}`).toBe(true)
  })

  it('never emits wildcard property-path for unreachable references', async () => {
    // A domain with no data edges to the requested reference target.
    // The compiler must never emit `(!<urn:none>)+` — it either reuses
    // a sibling edge, uses a SHACL chain, or drops the reference.
    const slots: SearchSlots = {
      domains: ['tzip21'],
      filters: {},
      ranges: {},
      references: [{ domain: 'ositrace' }],
    }
    const result = await compileSlotsWithTrace(slots)
    // The critical invariant: wildcard must never appear.
    expect(result.sparql).not.toContain('(!<urn:none>)+')
    // Policy-clean.
    const policy = enforceSparqlPolicy(result.sparql)
    expect(policy.allowed, `policy violations: ${policy.violations.join('; ')}`).toBe(true)
  })
})
