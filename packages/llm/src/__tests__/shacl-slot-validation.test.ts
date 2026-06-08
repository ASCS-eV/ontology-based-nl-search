/**
 * Integration tests for validateSlotsAgainstShacl — the function that
 * runs the W3C SHACL gate over an entire slot set.
 *
 * After task 21d-flat there is no dedicated `location` / `license`
 * parameter: every value lives in `filters` keyed by the SHACL leaf
 * local name, and the same gate handles geography, license, and any
 * other constraint declared in the shapes graph.
 *
 * Uses the real workspace ontology via ShaclValidator.fromWorkspace()
 * so we verify behaviour against actual SHACL constraints (e.g.
 * georeference:country carries `sh:pattern "^[a-zA-Z]{2}$"`).
 */
import { ShaclValidator } from '@ontology-search/search'
import { describe, expect, it } from 'vitest'

import { validateRangesAgainstShacl, validateSlotsAgainstShacl } from '../slot-validator.js'

describe('validateSlotsAgainstShacl — country values (post-flatten)', () => {
  it('keeps a fully-valid country array intact', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({ country: ['DE', 'FR', 'IT'] }, shacl)
    expect(result.filters.country).toEqual(['DE', 'FR', 'IT'])
    expect(result.gaps).toEqual([])
  }, 60_000)

  it('drops invalid elements and keeps valid ones', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    // "europe" fails sh:pattern "^[a-zA-Z]{2}$"; survivors stay.
    const result = await validateSlotsAgainstShacl({ country: ['DE', 'europe', 'FR'] }, shacl)
    expect(result.filters.country).toEqual(['DE', 'FR'])
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('europe')
  }, 60_000)

  it('drops the entire field when every element is invalid', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({ country: ['europe', 'continent'] }, shacl)
    expect(result.filters.country).toBeUndefined()
    expect(result.gaps.length).toBe(2)
  }, 60_000)

  it('accepts a single-string country', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({ country: 'DE' }, shacl)
    expect(result.filters.country).toBe('DE')
    expect(result.gaps).toEqual([])
  }, 60_000)

  it('rejects a single-string country that fails sh:pattern', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({ country: 'europe' }, shacl)
    expect(result.filters.country).toBeUndefined()
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
    // `numberLanes` is a real LLM hallucination observed end-to-end: the
    // workspace ontology models numberIntersections, numberObjects, etc.
    // but no numberLanes property exists.
    const result = await validateSlotsAgainstShacl({ numberLanes: '4' }, shacl)
    expect(result.filters.numberLanes).toBeUndefined()
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('numberLanes')
    expect(result.gaps[0]!.reason).toMatch(/not a known property/i)
  }, 60_000)

  it('drops an invented property name with an array value', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({ numberLanes: ['3', '4', '5'] }, shacl)
    expect(result.filters.numberLanes).toBeUndefined()
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('numberLanes')
  }, 60_000)

  it('keeps a known property key (roadTypes) so values flow into the value gate', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = await validateSlotsAgainstShacl({ roadTypes: 'motorway' }, shacl)
    expect(result.filters.roadTypes).toBe('motorway')
    expect(result.gaps).toEqual([])
  }, 60_000)
})

describe('validateRangesAgainstShacl — unknown range keys (R1 extension)', () => {
  it('drops an invented range key and emits an "unknown property" gap', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = validateRangesAgainstShacl({ numberLanes: { min: 4 } }, shacl)
    expect(result.ranges.numberLanes).toBeUndefined()
    expect(result.gaps.length).toBe(1)
    expect(result.gaps[0]!.term).toBe('numberLanes')
    expect(result.gaps[0]!.reason).toMatch(/not a known property/i)
  }, 60_000)

  it('keeps known range keys intact', async () => {
    const shacl = await ShaclValidator.fromWorkspace()
    const result = validateRangesAgainstShacl({ numberIntersections: { min: 1, max: 10 } }, shacl)
    expect(result.ranges.numberIntersections).toEqual({ min: 1, max: 10 })
    expect(result.gaps).toEqual([])
  }, 60_000)
})
