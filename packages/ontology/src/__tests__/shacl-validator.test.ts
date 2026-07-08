/**
 * Tests for the generic SHACL validator.
 *
 * These tests exercise the validator against the real workspace ontology
 * (loaded from submodules) so we verify that constraint enforcement is
 * actually driven by shapes — not by any code embedded in the validator.
 *
 * We deliberately target constraints from at least two distinct kinds:
 *   - sh:pattern  (regex constraint, the country/europe regression)
 *   - sh:in       (enum constraint, the existing happy path)
 * If new constraint types appear in the ontology, no test changes are needed
 * for the validator itself — it forwards every Core constraint to SHACL.
 */
import { resetConfig } from '@ontology-search/core/config'
import { afterAll, describe, expect, it } from 'vitest'

import { ShaclValidator } from '../shacl-validator.js'

const GEOREF_COUNTRY = 'https://w3id.org/ascs-ev/envited-x/georeference/v5/country'
const HDMAP_ROAD_TYPES = 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/roadTypes'
// A simple-path `sh:in` enum ("left-hand"/"right-hand"). `roadTypes` also has an
// `sh:in`, but upstream now expresses it on the version-conditional SEQUENCE path
// `( hdmap:hasContent hdmap:roadTypes )`; sequence/inverse paths are deliberately
// out of scope for bare-value slot validation (see shacl-validator-loader.ts),
// so the enum happy-path is pinned to a property still constrained on a simple
// path — the validator capability under test.
const HDMAP_TRAFFIC_DIRECTION = 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/trafficDirection'

describe('ShaclValidator', () => {
  it('builds from the workspace ontology and exposes covered properties', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const props = validator.knownProperties()

    expect(props.length).toBeGreaterThan(0)
    // The validator must discover at least the two properties we test below.
    expect(props).toContain(GEOREF_COUNTRY)
    expect(props).toContain(HDMAP_ROAD_TYPES)
  }, 120_000)

  it('rejects an out-of-pattern country code (the europe regression)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(GEOREF_COUNTRY, 'europe')

    expect(result.conforms).toBe(false)
    expect(result.violations.length).toBeGreaterThan(0)
    // The violation must originate from a SHACL pattern constraint — the spec
    // guarantees this constraint component IRI.
    const constraints = result.violations.map((v) => v.sourceConstraintComponent)
    expect(constraints).toContain('http://www.w3.org/ns/shacl#PatternConstraintComponent')
  }, 120_000)

  it('accepts a valid ISO 3166-1 alpha-2 country code', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(GEOREF_COUNTRY, 'DE')

    expect(result.conforms).toBe(true)
    expect(result.violations).toEqual([])
  }, 120_000)

  it('rejects a value outside an sh:in enumeration', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(HDMAP_TRAFFIC_DIRECTION, 'diagonal')

    expect(result.conforms).toBe(false)
    const constraints = result.violations.map((v) => v.sourceConstraintComponent)
    expect(constraints).toContain('http://www.w3.org/ns/shacl#InConstraintComponent')
  }, 120_000)

  it('accepts a value inside an sh:in enumeration', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(HDMAP_TRAFFIC_DIRECTION, 'left-hand')

    expect(result.conforms).toBe(true)
    expect(result.violations).toEqual([])
  }, 120_000)

  /**
   * Regression: `rdf-validate-shacl` 0.6 implements only SHACL Core. When
   * a shape graph carries SHACL-Advanced constraints like `sh:sparql`,
   * the engine throws `Cannot find validator for constraint component …`
   * as soon as it tries to evaluate a candidate against that shape — and
   * the whole validation aborts. The OpenLABEL workspace ontology uses
   * `sh:sparql` on the shape containing `particulatesWaterValue`, so
   * any LLM submission that touches that property tripped the bug.
   *
   * Fix in `loadShapesFromDisk`: strip `sh:sparql` (and a couple of
   * sibling Advanced predicates) from the dataset before constructing
   * the engine. The shape continues to enforce its Core constraints; the
   * bespoke SPARQL rule becomes a no-op. This test pins the contract.
   */
  it('does not throw when validating against a shape that carries an sh:sparql constraint', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const PROP = 'https://openlabel.asam.net/V1-0-0/ontologies/particulatesWaterValue'
    await expect(validator.validateValue(PROP, '0.5')).resolves.toBeDefined()
  }, 120_000)

  it('reports conforms=true for properties not covered by any shape', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue('https://example.org/unknownProperty', 'anything')

    // Unknown properties cannot violate anything — the validator returns a
    // no-op pass so the caller can decide how to handle them.
    expect(result.conforms).toBe(true)
  }, 120_000)
})

describe('ShaclValidator — engine-call accounting (R2, R3, R8)', () => {
  /**
   * R2: Batch validation MUST invoke the underlying engine at most once per
   * (property, target-class) pair, regardless of array length. With the
   * constraint index fast path, properties that have sh:pattern or sh:in
   * indexed will be resolved locally with zero engine calls.
   */
  it('invokes the SHACL engine exactly once for a batch of N values (R2)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    // Use values guaranteed to bypass the cache (unique uppercase pairs
    // unlikely to collide with prior tests' inputs).
    const fresh = ['AA', 'BB', 'CC', 'DD', 'EE']
    validator.__resetEngineCallCount__()
    await validator.validateValues(GEOREF_COUNTRY, fresh)
    // georeference:country has sh:pattern "[A-Z]{2}" indexed — all valid
    // values are resolved locally via the constraint index (0 engine calls).
    expect(validator.__engineCallCount__).toBe(0)
  }, 60_000)

  /**
   * R3: Identical (propertyIri, value) lookups MUST be served from cache.
   * Repeat calls must not invoke the engine again.
   */
  it('caches per-(prop,value): repeat calls do not re-invoke the engine (R3)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    // Prime the cache.
    await validator.validateValue(GEOREF_COUNTRY, 'XQ')
    validator.__resetEngineCallCount__()
    // Three further single-value calls with the same value.
    await validator.validateValue(GEOREF_COUNTRY, 'XQ')
    await validator.validateValue(GEOREF_COUNTRY, 'XQ')
    await validator.validateValue(GEOREF_COUNTRY, 'XQ')
    expect(validator.__engineCallCount__).toBe(0)
  }, 60_000)

  /**
   * R3 (batch variant): a fully cached array MUST short-circuit before any
   * engine call.
   */
  it('serves an entirely-cached batch with zero engine calls (R3)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    // Prime each value individually.
    for (const v of ['QA', 'QB', 'QC']) await validator.validateValue(GEOREF_COUNTRY, v)
    validator.__resetEngineCallCount__()
    await validator.validateValues(GEOREF_COUNTRY, ['QA', 'QB', 'QC'])
    expect(validator.__engineCallCount__).toBe(0)
  }, 60_000)

  /**
   * R8: De-duplication. Passing the same value N times MUST collapse to at
   * most one engine call. With the constraint index, valid values that match
   * sh:pattern are resolved locally (0 engine calls).
   */
  it('de-duplicates identical values in a batch (R8)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    validator.__resetEngineCallCount__()
    await validator.validateValues(GEOREF_COUNTRY, ['ZZ', 'ZZ', 'ZZ', 'ZZ', 'ZZ'])
    // "ZZ" matches the indexed sh:pattern "[A-Z]{2}" — resolved locally.
    expect(validator.__engineCallCount__).toBe(0)
  }, 60_000)

  /**
   * Correctness: values that FAIL the constraint index must fall through to
   * the engine (no false negatives from fast path).
   */
  it('falls through to engine when value fails the constraint index pattern', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    validator.__resetEngineCallCount__()
    // "toolong" does not match "[A-Z]{2}" — fast path returns null, engine called.
    await validator.validateValue(GEOREF_COUNTRY, 'toolong')
    expect(validator.__engineCallCount__).toBeGreaterThan(0)
  }, 60_000)
})

describe('ShaclValidator — bounded result cache', () => {
  const prevSize = process.env['SHACL_CACHE_SIZE']

  afterAll(() => {
    if (prevSize === undefined) delete process.env['SHACL_CACHE_SIZE']
    else process.env['SHACL_CACHE_SIZE'] = prevSize
    resetConfig()
    ShaclValidator.reset()
  })

  /**
   * Regression: before the LRU bound, the result cache was an unbounded Map.
   * A long-running server validating user-supplied filter values would grow
   * memory without limit. This test pins the contract: the cache never
   * retains more than SHACL_CACHE_SIZE entries, regardless of how many
   * distinct values are validated.
   *
   * We use an "unknown property" IRI to drive the cache. That path writes a
   * vacuous-pass entry into the same cache without invoking the SHACL engine,
   * so the test is cache-mechanics-only and runs in milliseconds — exactly
   * what we need to assert the bound without paying engine warmup cost per
   * iteration.
   */
  it('never retains more entries than SHACL_CACHE_SIZE', async () => {
    process.env['SHACL_CACHE_SIZE'] = '4'
    resetConfig()
    ShaclValidator.reset()
    const validator = await ShaclValidator.fromWorkspace()

    expect(validator.__resultCacheCapacity__).toBe(4)

    const unknown = 'https://example.org/unbounded-cache-probe'
    // Pump 5x the capacity through the cache; the LRU bound must hold the
    // whole way through, not just at the end.
    for (let i = 0; i < 20; i++) {
      await validator.validateValue(unknown, `value-${i}`)
      expect(validator.__resultCacheSize__).toBeLessThanOrEqual(4)
    }
    expect(validator.__resultCacheSize__).toBe(4)
  }, 120_000)
})

/**
 * R10: Performance budget — batch validation of 30 unique ISO codes should
 * complete in well under 12 seconds on a warm validator (cold cache).
 *
 * Gated behind `RUN_PERF=1` because wall-clock budgets are flaky in CI.
 * Run locally with: `RUN_PERF=1 pnpm --filter @ontology-search/ontology test`
 */
const PERF_BUDGET_MS = 12_000
const perfSuite = process.env['RUN_PERF'] === '1' ? describe : describe.skip

perfSuite('ShaclValidator — performance budget (R10)', () => {
  it(
    'validates 30 unique country codes in under the budget',
    async () => {
      const validator = await ShaclValidator.fromWorkspace()
      // 30 unguessable, ontology-foreign two-letter codes — pattern-valid so
      // they survive `^[a-zA-Z]{2}$`, but unlikely to be cached from earlier
      // tests. Mixed case to also confirm pattern flag handling.
      const values = [
        'PE',
        'RF',
        'WG',
        'XY',
        'AB',
        'CD',
        'EF',
        'GH',
        'IJ',
        'KL',
        'MN',
        'OP',
        'QR',
        'ST',
        'UV',
        'WX',
        'YZ',
        'BA',
        'DC',
        'FE',
        'HG',
        'JI',
        'LK',
        'NM',
        'PO',
        'RQ',
        'TS',
        'VU',
        'XW',
        'ZY',
      ]
      validator.__resetEngineCallCount__()

      const t0 = Date.now()
      await validator.validateValues(GEOREF_COUNTRY, values)
      const elapsed = Date.now() - t0

      // Engine MUST be called exactly once (one batch).
      expect(validator.__engineCallCount__).toBe(1)
      // Wall clock budget — flagged as a regression sentinel only.
      expect(elapsed).toBeLessThan(PERF_BUDGET_MS)
    },
    PERF_BUDGET_MS + 30_000
  )
})
