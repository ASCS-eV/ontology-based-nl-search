/**
 * Integration tests for validateSlotsAgainstShacl — the function that runs
 * the W3C SHACL gate over an entire slot set.
 *
 * Uses the real workspace ontology via ShaclValidator.fromWorkspace() so we
 * verify the array-aware location path against actual SHACL constraints
 * (e.g. georeference:country has sh:pattern "^[a-zA-Z]{2}$").
 */
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
import { describe, expect, it } from 'vitest'

import { validateRangesAgainstShacl, validateSlotsAgainstShacl } from '../slot-validator.js'

describe('validateSlotsAgainstShacl — location arrays', () => {
  it('keeps a fully-valid country array intact', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl(
      {},
      { country: ['DE', 'FR', 'IT'] },
      undefined,
      shacl
    )
    expect(result.location.country).toEqual(['DE', 'FR', 'IT'])
    expect(result.gaps).toEqual([])
  }, 60_000)

  it('drops invalid elements and keeps valid ones', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl(
      {},
      // "europe" fails sh:pattern "^[a-zA-Z]{2}$"; survivors stay.
      { country: ['DE', 'europe', 'FR'] },
      undefined,
      shacl
    )
    expect(result.location.country).toEqual(['DE', 'FR'])
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('europe')
  }, 60_000)

  it('drops the entire field when every element is invalid', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl(
      {},
      { country: ['europe', 'continent'] },
      undefined,
      shacl
    )
    expect(result.location.country).toBeUndefined()
    expect(result.gaps.length).toBe(2)
  }, 60_000)

  it('still accepts single-string country (backward compat)', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({}, { country: 'DE' }, undefined, shacl)
    expect(result.location.country).toBe('DE')
    expect(result.gaps).toEqual([])
  }, 60_000)

  it('rejects a single-string country that fails sh:pattern', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({}, { country: 'europe' }, undefined, shacl)
    expect(result.location.country).toBeUndefined()
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('europe')
  }, 60_000)
})

describe('validateSlotsAgainstShacl — unknown filter keys (R1)', () => {
  /**
   * R1: A filter key whose local name has no corresponding sh:PropertyShape
   * in the loaded ontology MUST be dropped, and a gap MUST be emitted that
   * explains the key is unknown (so the LLM caller / refine UI can react).
   */
  it('drops an invented property name and emits an "unknown property" gap', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl(
      // `numberLanes` is a real LLM hallucination observed end-to-end: the
      // ENVITED-X hdmap ontology models numberIntersections, numberObjects,
      // numberTrafficSigns etc. but no numberLanes property exists.
      { numberLanes: '4' },
      undefined,
      undefined,
      shacl
    )
    expect(result.filters.numberLanes).toBeUndefined()
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('numberLanes')
    expect(result.gaps[0]!.reason).toMatch(/not a known property/i)
  }, 60_000)

  /**
   * R1 (array variant): Same behaviour when the LLM emits an array value
   * under an unknown key — the entire key is dropped and one gap surfaced.
   */
  it('drops an invented property name with an array value', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl(
      { numberLanes: ['3', '4', '5'] },
      undefined,
      undefined,
      shacl
    )
    expect(result.filters.numberLanes).toBeUndefined()
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('numberLanes')
  }, 60_000)

  /**
   * R1: Known property keys are NOT dropped by the unknown-key gate — only
   * value-level SHACL failures can drop them (verified by the existing
   * country/europe tests above).
   */
  it('keeps a known property key (roadTypes) so values flow into the value gate', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl(
      { roadTypes: 'motorway' },
      undefined,
      undefined,
      shacl
    )
    expect(result.filters.roadTypes).toBe('motorway')
    expect(result.gaps).toEqual([])
  }, 60_000)
})

describe('validateRangesAgainstShacl — unknown range keys (R1 extension)', () => {
  /**
   * R1 extension for ranges: the LLM emitted `ranges.numberLanes = { min:4 }`
   * for a non-existent ontology property, and the compiler happily produced
   * `?qty hdmap:numberLanes ?numberLanes` (0 results, no diagnostic).
   * The range path needs the same unknown-key check as filters.
   */
  it('drops an invented range key and emits an "unknown property" gap', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = validateRangesAgainstShacl({ numberLanes: { min: 4 } }, shacl)
    expect(result.ranges.numberLanes).toBeUndefined()
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('numberLanes')
    expect(result.gaps[0]!.reason).toMatch(/not a known property/i)
  }, 60_000)

  /**
   * Negative case: a known range property (numberIntersections in hdmap)
   * MUST flow through unchanged.
   */
  it('keeps known range keys intact', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = validateRangesAgainstShacl({ numberIntersections: { min: 1, max: 10 } }, shacl)
    expect(result.ranges.numberIntersections).toEqual({ min: 1, max: 10 })
    expect(result.gaps).toEqual([])
  }, 60_000)
})
