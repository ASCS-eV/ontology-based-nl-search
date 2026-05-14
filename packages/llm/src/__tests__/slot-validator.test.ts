import type { OntologyVocabulary } from '@ontology-search/search'
import { describe, expect, it } from 'vitest'

import { correctDomains, correctFilters, validateSlots } from '../slot-validator.js'
import type { LlmStructuredResponse } from '../types.js'

const testVocabulary: OntologyVocabulary = {
  enumProperties: [
    {
      localName: 'roadTypes',
      domain: 'hdmap',
      iri: 'https://example.org/hdmap/v6/roadTypes',
      label: 'road types',
      description: '',
      allowedValues: ['motorway', 'rural', 'urban', 'intersection'],
    },
    {
      localName: 'roadTypes',
      domain: 'ositrace',
      iri: 'https://example.org/ositrace/v6/roadTypes',
      label: 'road types',
      description: '',
      allowedValues: ['motorway', 'rural', 'urban', 'intersection'],
    },
    {
      localName: 'scenarioCategory',
      domain: 'scenario',
      iri: 'https://example.org/scenario/v6/scenarioCategory',
      label: 'scenario category',
      description: '',
      allowedValues: ['cut-in', 'lane-change', 'emergency-braking', 'overtaking'],
    },
    {
      localName: 'weatherSummary',
      domain: 'scenario',
      iri: 'https://example.org/scenario/v6/weatherSummary',
      label: 'weather summary',
      description: '',
      allowedValues: ['clear', 'rain', 'fog', 'snow'],
    },
  ],
  numericProperties: [
    {
      localName: 'length',
      domain: 'hdmap',
      iri: 'https://example.org/hdmap/v6/length',
      label: 'length',
      description: '',
      datatype: 'float',
    },
  ],
  domains: ['hdmap', 'scenario', 'ositrace'],
  conceptSchemes: new Map(),
  classHierarchy: [],
  instanceValues: new Map(),
}

describe('correctFilters', () => {
  it('keeps exact matches unchanged', () => {
    const filters = { roadTypes: 'motorway', weatherSummary: 'rain' }
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ roadTypes: 'motorway', weatherSummary: 'rain' })
  })

  it('corrects case-insensitive matches', () => {
    const filters = { roadTypes: 'Motorway' }
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ roadTypes: 'motorway' })
  })

  it('fuzzy-matches close values', () => {
    const filters = { roadTypes: 'motoway' } // typo
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ roadTypes: 'motorway' })
  })

  it('drops values with no match', () => {
    const filters = { roadTypes: 'completely-unknown-value' }
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({})
  })

  it('handles array values', () => {
    const filters = { roadTypes: ['motorway', 'rurall'] } // rurall = fuzzy match
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ roadTypes: ['motorway', 'rural'] })
  })

  it('passes through unknown properties', () => {
    const filters = { unknownProp: 'someValue' }
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ unknownProp: 'someValue' })
  })

  it('corrects substring matches', () => {
    const filters = { roadTypes: 'motorways' } // plural
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ roadTypes: 'motorway' })
  })
})

describe('validateSlots', () => {
  it('recomputes confidence to high for exact matches', () => {
    const response: LlmStructuredResponse = {
      interpretation: {
        summary: 'test',
        mappedTerms: [
          { input: 'highway', mapped: 'motorway', confidence: 'medium', property: 'roadTypes' },
        ],
      },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.interpretation.mappedTerms[0]!.confidence).toBe('high')
    expect(result.interpretation.mappedTerms[0]!.mapped).toBe('motorway')
  })

  it('corrects fuzzy matches and sets confidence to medium', () => {
    const response: LlmStructuredResponse = {
      interpretation: {
        summary: 'test',
        mappedTerms: [
          { input: 'highway', mapped: 'motoway', confidence: 'high', property: 'roadTypes' },
        ],
      },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.interpretation.mappedTerms[0]!.mapped).toBe('motorway')
    expect(result.interpretation.mappedTerms[0]!.confidence).toBe('medium')
  })

  it('keeps unmatchable values as low-confidence and reports as gap', () => {
    const response: LlmStructuredResponse = {
      interpretation: {
        summary: 'test',
        mappedTerms: [
          {
            input: 'takeover',
            mapped: 'vehicle-takeover',
            confidence: 'high',
            property: 'scenarioCategory',
          },
        ],
      },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    // Unmatched terms stay visible (low confidence) so the user can edit them
    expect(result.interpretation.mappedTerms).toHaveLength(1)
    expect(result.interpretation.mappedTerms[0]!.confidence).toBe('low')
    expect(result.interpretation.mappedTerms[0]!.mapped).toBe('vehicle-takeover')
    // Also reported as gap with suggestions
    expect(result.gaps).toHaveLength(1)
    expect(result.gaps[0]!.term).toBe('takeover')
    expect(result.gaps[0]!.reason).toContain('not a valid value')
  })

  it('enriches gaps with suggestions from vocabulary', () => {
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      gaps: [{ term: 'overtake', reason: 'Not found' }],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.gaps[0]!.suggestions).toBeDefined()
    expect(result.gaps[0]!.suggestions!.length).toBeGreaterThan(0)
    // "overtake" should find "overtaking" as a suggestion
    expect(result.gaps[0]!.suggestions!.some((s) => s.includes('overtaking'))).toBe(true)
  })

  it('preserves location properties without vocabulary validation', () => {
    const response: LlmStructuredResponse = {
      interpretation: {
        summary: 'test',
        mappedTerms: [{ input: 'Germany', mapped: 'DE', confidence: 'high', property: 'country' }],
      },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.interpretation.mappedTerms[0]!.mapped).toBe('DE')
    expect(result.interpretation.mappedTerms[0]!.confidence).toBe('high')
  })

  it('preserves numeric range terms with high confidence', () => {
    const response: LlmStructuredResponse = {
      interpretation: {
        summary: 'test',
        mappedTerms: [{ input: '5 km', mapped: '5', confidence: 'medium', property: 'length' }],
      },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.interpretation.mappedTerms[0]!.confidence).toBe('high')
  })
})

describe('correctDomains', () => {
  it('keeps domains when filters match', () => {
    const result = correctDomains(['hdmap'], { roadTypes: 'motorway' }, {}, testVocabulary)
    expect(result).toEqual(['hdmap'])
  })

  it('corrects domain when filters belong to a different domain', () => {
    // LLM chose "scenario" but roadTypes exists in hdmap+ositrace, not scenario
    // Since roadTypes doesn't exist in scenario, we should keep scenario AND add the domains where roadTypes exists
    const result = correctDomains(['scenario'], { roadTypes: 'motorway' }, {}, testVocabulary)
    expect(result).toContain('scenario') // Keep LLM's original choice
    expect(result).toContain('hdmap') // Add domain where property exists
    // Note: In reality, this would search scenarios that reference hdmaps/ositraces with motorways
  })

  it('keeps chosen domain when property exists there (multi-domain property)', () => {
    // LLM chose "hdmap" and roadTypes exists in hdmap → keep hdmap only
    const result = correctDomains(['hdmap'], { roadTypes: 'motorway' }, {}, testVocabulary)
    expect(result).toEqual(['hdmap'])
  })

  it('keeps chosen domain when property exists there (ositrace)', () => {
    // LLM chose "ositrace" and roadTypes exists in ositrace → keep ositrace only
    const result = correctDomains(['ositrace'], { roadTypes: 'motorway' }, {}, testVocabulary)
    expect(result).toEqual(['ositrace'])
  })

  it('handles numeric ranges for domain correction', () => {
    // length only exists in hdmap, so replace scenario with hdmap
    const result = correctDomains(['scenario'], {}, { length: { min: 5 } }, testVocabulary)
    expect(result).toContain('scenario')
    expect(result).toContain('hdmap')
  })

  it('keeps original domains when no filters are present', () => {
    const result = correctDomains(['scenario'], {}, {}, testVocabulary)
    expect(result).toEqual(['scenario'])
  })

  it('merges domains when filters span multiple domains', () => {
    const result = correctDomains(
      ['hdmap'],
      { roadTypes: 'motorway', scenarioCategory: 'cut-in' },
      {},
      testVocabulary
    )
    expect(result).toContain('hdmap')
    expect(result).toContain('scenario')
  })
})
