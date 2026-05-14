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
