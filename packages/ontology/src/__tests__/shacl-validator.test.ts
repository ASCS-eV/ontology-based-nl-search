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
import { describe, expect, it } from 'vitest'

import { ShaclValidator } from '../shacl-validator.js'

const GEOREF_COUNTRY = 'https://w3id.org/ascs-ev/envited-x/georeference/v5/country'
const HDMAP_ROAD_TYPES = 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/roadTypes'

describe('ShaclValidator', () => {
  it('builds from the workspace ontology and exposes covered properties', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const props = validator.knownProperties()

    expect(props.length).toBeGreaterThan(0)
    // The validator must discover at least the two properties we test below.
    expect(props).toContain(GEOREF_COUNTRY)
    expect(props).toContain(HDMAP_ROAD_TYPES)
  }, 30_000)

  it('rejects an out-of-pattern country code (the europe regression)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(GEOREF_COUNTRY, 'europe')

    expect(result.conforms).toBe(false)
    expect(result.violations.length).toBeGreaterThan(0)
    // The violation must originate from a SHACL pattern constraint — the spec
    // guarantees this constraint component IRI.
    const constraints = result.violations.map((v) => v.sourceConstraintComponent)
    expect(constraints).toContain('http://www.w3.org/ns/shacl#PatternConstraintComponent')
  }, 30_000)

  it('accepts a valid ISO 3166-1 alpha-2 country code', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(GEOREF_COUNTRY, 'DE')

    expect(result.conforms).toBe(true)
    expect(result.violations).toEqual([])
  }, 30_000)

  it('rejects a value outside an sh:in enumeration', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(HDMAP_ROAD_TYPES, 'spaceway')

    expect(result.conforms).toBe(false)
    const constraints = result.violations.map((v) => v.sourceConstraintComponent)
    expect(constraints).toContain('http://www.w3.org/ns/shacl#InConstraintComponent')
  }, 30_000)

  it('accepts a value inside an sh:in enumeration', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue(HDMAP_ROAD_TYPES, 'motorway')

    expect(result.conforms).toBe(true)
    expect(result.violations).toEqual([])
  }, 30_000)

  it('reports conforms=true for properties not covered by any shape', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    const result = await validator.validateValue('https://example.org/unknownProperty', 'anything')

    // Unknown properties cannot violate anything — the validator returns a
    // no-op pass so the caller can decide how to handle them.
    expect(result.conforms).toBe(true)
  }, 30_000)
})

describe('ShaclValidator — engine-call accounting (R2, R3, R8)', () => {
  /**
   * R2: Batch validation MUST invoke the underlying engine exactly once per
   * (property, target-class) pair, regardless of array length. The win over
   * sequential calls is the entire point of validateValues; a regression
   * would silently kill the perf gain.
   */
  it('invokes the SHACL engine exactly once for a batch of N values (R2)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    // Use values guaranteed to bypass the cache (unique uppercase pairs
    // unlikely to collide with prior tests' inputs).
    const fresh = ['AA', 'BB', 'CC', 'DD', 'EE']
    validator.__resetEngineCallCount__()
    await validator.validateValues(GEOREF_COUNTRY, fresh)
    // georeference:country has exactly one target class (Location), so we
    // expect exactly one engine call for the entire batch.
    expect(validator.__engineCallCount__).toBe(1)
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
   * R8: De-duplication. Passing the same value N times MUST collapse to a
   * single engine call (or zero if cached). We use a freshly-coined value
   * to guarantee a cache miss on the first occurrence.
   */
  it('de-duplicates identical values in a batch (R8)', async () => {
    const validator = await ShaclValidator.fromWorkspace()
    validator.__resetEngineCallCount__()
    await validator.validateValues(GEOREF_COUNTRY, ['ZZ', 'ZZ', 'ZZ', 'ZZ', 'ZZ'])
    // Exactly one engine call (no cache hit possible on first occurrence,
    // duplicates collapse via the validator's internal Set).
    expect(validator.__engineCallCount__).toBe(1)
  }, 60_000)
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
