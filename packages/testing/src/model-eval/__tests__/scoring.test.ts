import { describe, expect, it } from 'vitest'

import { canonicalizeSlots, scoreSample, scoreSlots } from '../scoring.js'
import { EVALUATION_SCHEMA_VERSION, GoldCaseSchema } from '../types.js'

const gold = GoldCaseSchema.parse({
  schemaVersion: EVALUATION_SCHEMA_VERSION,
  id: 'score-001',
  suite: 'envited-x',
  locale: 'en',
  query: 'motorway maps',
  expected: {
    slots: {
      domains: ['hdmap'],
      filters: { roadTypes: ['motorway', 'motorway_entry'] },
      ranges: {},
    },
    gaps: [],
  },
  categories: ['enum'],
  risk: 'normal',
  toolPolicy: {
    allowed: ['find_terms'],
    required: [],
    maxLookups: 1,
    directSubmissionAllowed: true,
  },
})

describe('slot scoring', () => {
  it('sorts domains, filter values, and recursive reference siblings', () => {
    const canonical = canonicalizeSlots({
      domains: ['scenario', 'hdmap'],
      filters: { roadTypes: ['motorway_entry', 'motorway'] },
      ranges: {},
      references: [
        { domain: 'sensor', references: [{ domain: 'scenario' }, { domain: 'hdmap' }] },
        { domain: 'hdmap', filters: { country: ['SE', 'DE'] } },
      ],
    })

    expect(canonical.domains).toEqual(['hdmap', 'scenario'])
    expect(canonical.filters.roadTypes).toEqual(['motorway', 'motorway_entry'])
    expect(canonical.references).toEqual([
      { domain: 'hdmap', filters: { country: ['DE', 'SE'] } },
      { domain: 'sensor', references: [{ domain: 'hdmap' }, { domain: 'scenario' }] },
    ])
  })

  it('preserves recursive topology while ignoring sibling order', () => {
    const expected = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap', references: [{ domain: 'sensor' }] }],
    }
    const wrongTopology = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap' }, { domain: 'sensor' }],
    }

    expect(scoreSlots(expected, expected).referenceTopologyExact).toBe(true)
    expect(scoreSlots(expected, wrongTopology).referenceTopologyExact).toBe(false)
  })

  it('compares property names and enum values case-sensitively', () => {
    const actual = {
      domains: ['hdmap'],
      filters: { RoadTypes: ['Motorway', 'motorway_entry'] },
      ranges: {},
    }

    const score = scoreSlots(gold.expected.slots, actual)
    expect(score.exact).toBe(false)
    expect(score.falsePositive).toBeGreaterThan(0)
    expect(score.falseNegative).toBeGreaterThan(0)
  })

  it('reports raw and post-validation exactness independently', () => {
    const score = scoreSample({
      gold,
      raw: { domains: ['hdmap'], filters: { roadTypes: 'motorway' }, ranges: {} },
      validated: gold.expected.slots,
      actualGapTerms: [],
      lookupNames: [],
      compilationValid: true,
    })

    expect(score.rawExact).toBe(false)
    expect(score.validatedExact).toBe(true)
    expect(score.requiredLookupsSatisfied).toBe(true)
  })

  it('rejects lookup classes outside the case policy without penalizing direct submission', () => {
    const direct = scoreSample({
      gold,
      raw: gold.expected.slots,
      validated: gold.expected.slots,
      actualGapTerms: [],
      lookupNames: [],
      compilationValid: true,
    })
    const forbiddenLookup = scoreSample({
      gold,
      raw: gold.expected.slots,
      validated: gold.expected.slots,
      actualGapTerms: [],
      lookupNames: ['probe_data'],
      compilationValid: true,
    })

    expect(direct.requiredLookupsSatisfied).toBe(true)
    expect(forbiddenLookup.requiredLookupsSatisfied).toBe(false)
  })
})
