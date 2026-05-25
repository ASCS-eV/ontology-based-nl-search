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

import { compileSlots } from '../compiler.js'
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

  // ─── Location filters ──────────────────────────────────────────────────

  it('location with single country (STR matching)', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: 'DE' },
    })
    expect(sparql).toMatchSnapshot()
  })

  it('location with multi-value country array (FILTER IN matching)', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: ['DE', 'FR', 'IT'] },
    })
    expect(sparql).toMatchSnapshot()
  })

  it('location with single-element country array collapses to FILTER IN of one', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: ['DE'] },
    })
    expect(sparql).toMatchSnapshot()
  })

  it('location with all four geographic fields populated', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: 'DE', state: 'Bavaria', region: 'Oberbayern', city: 'Munich' },
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── License ────────────────────────────────────────────────────────────

  it('license-only filter', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      license: 'CC-BY-4.0',
    })
    expect(sparql).toMatchSnapshot()
  })

  it('license combined with content filter', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
      license: 'CC-BY-4.0',
    })
    expect(sparql).toMatchSnapshot()
  })

  // ─── Combinations & cross-domain ──────────────────────────────────────

  it('hdmap with filter + range + location + license combined', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: { numberIntersections: { min: 5, max: 50 } },
      location: { country: 'DE' },
      license: 'CC-BY-4.0',
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
      location: undefined,
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

  it('peer domains (hdmap + ositrace) with location → UNION with country filter', async () => {
    const sparql = await assertDeterministic({
      domains: ['hdmap', 'ositrace'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
      location: { country: 'FR' },
    })
    expect(sparql).toContain('UNION')
    expect(sparql).toContain('country')
    expect(sparql).toMatchSnapshot()
  })
})
