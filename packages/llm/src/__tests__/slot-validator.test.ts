import type { SchemaVocabulary } from '@ontology-search/search'
import type { LlmStructuredResponse } from '@ontology-search/search/types'
import { describe, expect, it } from 'vitest'

import { correctDomains, correctFilters, validateSlots } from '../slot-validator.js'

const testVocabulary: SchemaVocabulary = {
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
    {
      localName: 'surfaceType',
      domain: 'ositrace',
      iri: 'https://example.org/ositrace/v6/surfaceType',
      label: 'surface type',
      description: '',
      allowedValues: ['asphalt', 'concrete', 'gravel'],
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
  /**
   * Local name → owning domains, as the compiler resolves them.
   *
   * `surfaceType` models the real ontology's asymmetry: `ositrace` enumerates
   * it with `sh:in` (so it appears in `enumProperties`), while `hdmap` only
   * types it with `sh:datatype` (so it appears in neither property list) even
   * though the compiler can filter it in both.
   */
  propertyDomains: new Map<string, readonly string[]>([
    ['roadTypes', ['hdmap', 'ositrace']],
    ['scenarioCategory', ['scenario']],
    ['weatherSummary', ['scenario']],
    ['length', ['hdmap']],
    ['surfaceType', ['hdmap', 'ositrace']],
  ]),
  conceptSchemes: new Map(),
  classHierarchy: [],
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

  it('passes through values with no fuzzy match — SHACL is the gate', () => {
    // Pre-flatten behaviour was to drop unmatched enum values silently.
    // Post-flatten the downstream SHACL gate (validateSlotsAgainstShacl)
    // emits a structured gap; correctFilters must let the value through
    // for that to happen. Otherwise the caller sees an empty filter and
    // no explanation.
    const filters = { roadTypes: 'completely-unknown-value' }
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ roadTypes: 'completely-unknown-value' })
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

  it('does not "correct" a substring-overlapping value to an unrelated enum', () => {
    // "suburban" contains "urban" but is a different concept. The previous
    // substring-distance matcher wrongly corrected it to "urban" (length-diff
    // 3 < the absolute threshold 4); the normalized-similarity gate scores
    // 1 - 3/8 = 0.625 < 0.8 and correctly lets it pass through to SHACL.
    const filters = { roadTypes: 'suburban' }
    const result = correctFilters(filters, testVocabulary)
    expect(result).toEqual({ roadTypes: 'suburban' })
  })

  it('expands a prefixed name to the IRI-valued enum member it abbreviates', () => {
    // Regression: the LLM echoed `ex:RoadTypeMotorway` as shown in the
    // prompt; edit distance to the full IRI is huge, so the value fell
    // through to SHACL, failed `sh:in`, and the filter was dropped.
    const iri = 'https://example.org/odd/RoadTypeMotorway'
    const vocabulary: SchemaVocabulary = {
      ...testVocabulary,
      enumProperties: [
        {
          localName: 'drivableArea',
          domain: 'scenario',
          iri: 'https://example.org/odd/drivableArea',
          label: 'drivable area',
          description: '',
          allowedValues: ['https://example.org/odd/RoadTypeRural', iri],
        },
      ],
    }
    expect(correctFilters({ drivableArea: 'ex:RoadTypeMotorway' }, vocabulary)).toEqual({
      drivableArea: iri,
    })
    // A literal-valued enum is never matched through a prefix.
    expect(correctFilters({ roadTypes: 'vocabulary:motorway' }, testVocabulary)).toEqual({
      roadTypes: 'vocabulary:motorway',
    })
  })

  describe('prefixed names across vocabularies sharing a local name', () => {
    const v1 = 'https://example.org/vocab-a/v1/RoadTypeMotorway'
    const v2 = 'https://example.org/vocab-b/v2/RoadTypeMotorway'
    const vocabulary: SchemaVocabulary = {
      ...testVocabulary,
      enumProperties: [
        {
          localName: 'drivableArea',
          domain: 'scenario',
          iri: 'https://example.org/odd/drivableArea',
          label: 'drivable area',
          description: '',
          allowedValues: [v1, v2],
        },
      ],
    }
    const prefixes = new Map<string, readonly string[]>([
      ['a', ['https://example.org/vocab-a/v1/']],
      ['b', ['https://example.org/vocab-b/v2/']],
      // One prefix bound to two namespaces by two loaded vocabularies.
      ['shared', ['https://example.org/vocab-a/v1/', 'https://example.org/vocab-b/v2/']],
    ])

    it('lets the prefix pick the vocabulary, not the member order', () => {
      expect(correctFilters({ drivableArea: 'a:RoadTypeMotorway' }, vocabulary, prefixes)).toEqual({
        drivableArea: v1,
      })
      expect(correctFilters({ drivableArea: 'b:RoadTypeMotorway' }, vocabulary, prefixes)).toEqual({
        drivableArea: v2,
      })
    })

    it('does not fall back to another vocabulary when the prefix is declared but unmatched', () => {
      const onlyV1: SchemaVocabulary = {
        ...vocabulary,
        enumProperties: [{ ...vocabulary.enumProperties[0]!, allowedValues: [v1] }],
      }
      expect(correctFilters({ drivableArea: 'b:RoadTypeMotorway' }, onlyV1, prefixes)).toEqual({
        drivableArea: 'b:RoadTypeMotorway',
      })
    })

    it('refuses a prefix bound to several namespaces that each hold the local name', () => {
      expect(
        correctFilters({ drivableArea: 'shared:RoadTypeMotorway' }, vocabulary, prefixes)
      ).toEqual({ drivableArea: 'shared:RoadTypeMotorway' })
    })

    it('resolves a prefix bound to several namespaces when only one holds the local name', () => {
      const onlyV2: SchemaVocabulary = {
        ...vocabulary,
        enumProperties: [{ ...vocabulary.enumProperties[0]!, allowedValues: [v2] }],
      }
      expect(correctFilters({ drivableArea: 'shared:RoadTypeMotorway' }, onlyV2, prefixes)).toEqual(
        { drivableArea: v2 }
      )
    })

    it('refuses an undeclared prefix when the local name is ambiguous', () => {
      expect(correctFilters({ drivableArea: 'zz:RoadTypeMotorway' }, vocabulary, prefixes)).toEqual(
        { drivableArea: 'zz:RoadTypeMotorway' }
      )
      // Without any prefix map the same ambiguity holds.
      expect(correctFilters({ drivableArea: 'a:RoadTypeMotorway' }, vocabulary)).toEqual({
        drivableArea: 'a:RoadTypeMotorway',
      })
    })

    it('accepts an undeclared prefix when exactly one member carries the local name', () => {
      const unique: SchemaVocabulary = {
        ...vocabulary,
        enumProperties: [{ ...vocabulary.enumProperties[0]!, allowedValues: [v1] }],
      }
      expect(correctFilters({ drivableArea: 'zz:RoadTypeMotorway' }, unique, prefixes)).toEqual({
        drivableArea: v1,
      })
    })
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

  it('preserves the compiler traceability plans (per-row breadcrumbs reach the UI)', () => {
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
      trace: [
        {
          sourceVariable: 'asset',
          targetVariable: 'refAsset',
          steps: [{ variable: 'ref_step_1', predicate: 'https://example.org/onto#hasManifest' }],
        },
      ],
    }

    const result = validateSlots(response, testVocabulary)
    // The final validation pass must not strip `trace`, or breadcrumbs vanish
    // end-to-end (the bug the integration test's mocked LLM masked).
    expect(result.trace).toEqual(response.trace)
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

  it('anchors a term to the compiled slot value when its explanation describes it', () => {
    // `mapped` is free text: the model sometimes writes an expression instead
    // of the value. The compiled filter is valid, so this is no gap.
    const response: LlmStructuredResponse = {
      interpretation: {
        summary: 'test',
        mappedTerms: [
          {
            input: 'cut-in scenarios',
            mapped: "scenarioCategory = 'cut-in'",
            confidence: 'low',
            property: 'scenarioCategory',
          },
        ],
      },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
      slots: { domains: ['scenario'], filters: { scenarioCategory: 'cut-in' }, ranges: {} },
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.gaps).toEqual([])
    expect(result.interpretation.mappedTerms[0]).toMatchObject({
      mapped: 'cut-in',
      confidence: 'high',
    })
  })

  it('reads the values of reference-scoped filters', () => {
    const response: LlmStructuredResponse = {
      interpretation: {
        summary: 'test',
        mappedTerms: [
          {
            input: 'on highways',
            mapped: 'the road types of the referenced map',
            confidence: 'medium',
            property: 'roadTypes',
          },
        ],
      },
      gaps: [],
      sparql: 'SELECT * WHERE { }',
      slots: {
        domains: ['scenario'],
        filters: {},
        ranges: {},
        references: [{ domain: 'hdmap', filters: { roadTypes: ['motorway', 'rural'] } }],
      },
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.gaps).toEqual([])
    expect(result.interpretation.mappedTerms[0]).toMatchObject({
      mapped: 'motorway, rural',
      confidence: 'high',
    })
  })

  it('still reports a gap when the slots hold no allowed value for the property', () => {
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
      slots: { domains: ['scenario'], filters: { weatherSummary: 'rain' }, ranges: {} },
    }

    const result = validateSlots(response, testVocabulary)
    expect(result.interpretation.mappedTerms[0]!.confidence).toBe('low')
    expect(result.gaps).toHaveLength(1)
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

  /**
   * Regression: the gap-enricher previously suggested unrelated short
   * strings (e.g. `IT-AP`, `PH-MAS`, `PythonAPI` for a "maps" gap)
   * because full-string Levenshtein on a multi-word `gap.term` could
   * align any matching character anywhere. Tokenisation + a higher
   * 0.5 floor + substring containment keeps signal in, noise out.
   *
   * The mock vocabulary has `roadTypes` containing "motorway" — a
   * substring of which is NOT in "with maps" — so we use the
   * scenarioCategory enum to assert positive behaviour and we assert
   * that no all-noise candidate slips through for a multi-word gap.
   */
  it('keeps gap suggestions tight: substring tokens win, multi-word noise rejected', () => {
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      // The gap term shares a stem ("overtak") with one mock value
      // ("overtaking" under scenarioCategory) and nothing else — the
      // enricher should surface that one and reject the other 5
      // scenarioCategory values that have no token overlap.
      gaps: [{ term: 'with overtaking', reason: 'Not found' }],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    const suggestions = result.gaps[0]!.suggestions ?? []
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((s) => s.includes('overtaking'))).toBe(true)
    // Nothing matching only by 5-character-soup similarity should
    // creep in. "cut-in" / "lane-change" / "emergency-braking" share
    // no token with "with overtaking" (after stopword filtering).
    expect(suggestions.some((s) => s.includes('cut-in'))).toBe(false)
    expect(suggestions.some((s) => s.includes('lane-change'))).toBe(false)
  })

  /**
   * Regression for the coverage-scored containment channel: a short enum
   * value that is only a COINCIDENTAL substring of the gap term must not be
   * suggested. "urban" sits inside "suburbanization" but is unrelated — the
   * old flat reverse-containment boost scored it 0.9 and surfaced it; coverage
   * scoring gives 5/15 = 0.33, below the floor. (This is the class of bug the
   * e2e surfaced: a dropped numeric "laneCount" gap suggesting "CO" because
   * "co" is a substring of "lanecount".)
   */
  it('rejects a short enum value that only coincidentally substrings the gap term', () => {
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      gaps: [{ term: 'suburbanization', reason: 'Not found' }],
      sparql: 'SELECT * WHERE { }',
    }
    const result = validateSlots(response, testVocabulary)
    const suggestions = result.gaps[0]!.suggestions ?? []
    expect(suggestions.some((s) => s.includes('urban'))).toBe(false)
  })

  /**
   * Regression: two-letter codes (ISO country/jurisdiction lists) were offered
   * as "related concepts" because the gap word "its" stems to "it" and
   * contains the code `IT`, and "stops" contains `ST`.
   */
  it('never suggests a two-letter code that only substrings a gap word', () => {
    const vocabulary: SchemaVocabulary = {
      ...testVocabulary,
      enumProperties: [
        ...testVocabulary.enumProperties,
        {
          localName: 'jurisdiction',
          domain: 'service',
          iri: 'https://example.org/service/jurisdiction',
          label: 'jurisdiction',
          description: '',
          allowedValues: ['IT', 'IS', 'ST', 'TO'],
        },
      ],
    }
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      gaps: [{ term: 'approaches its path and stops', reason: 'Not found' }],
      sparql: 'SELECT * WHERE { }',
    }
    const suggestions = validateSlots(response, vocabulary).gaps[0]!.suggestions ?? []
    expect(suggestions.some((s) => s.includes('(jurisdiction)'))).toBe(false)
  })

  it('still suggests a code when the gap term is exactly that code', () => {
    const vocabulary: SchemaVocabulary = {
      ...testVocabulary,
      enumProperties: [
        {
          localName: 'jurisdiction',
          domain: 'service',
          iri: 'https://example.org/service/jurisdiction',
          label: 'jurisdiction',
          description: '',
          allowedValues: ['IT', 'IS'],
        },
      ],
    }
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      gaps: [{ term: 'it', reason: 'Not found' }],
      sparql: 'SELECT * WHERE { }',
    }
    expect(validateSlots(response, vocabulary).gaps[0]!.suggestions).toEqual(['IT (jurisdiction)'])
  })

  /**
   * Regression: an identifier code list with thousands of entries (media
   * types) always had some value fuzzy-matching some word of a free-text gap
   * ("audible" -> "audio/L8"), drowning the real concept suggestions.
   */
  it('excludes identifier-sized code lists from gap suggestions', () => {
    const codes = Array.from({ length: 300 }, (_, i) => `audio/L${i}`)
    const vocabulary: SchemaVocabulary = {
      ...testVocabulary,
      enumProperties: [
        ...testVocabulary.enumProperties,
        {
          localName: 'mediaTypes',
          domain: 'service',
          iri: 'https://example.org/service/mediaTypes',
          label: 'media types',
          description: '',
          allowedValues: codes,
        },
      ],
    }
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      gaps: [{ term: 'audio overtaking', reason: 'Not found' }],
      sparql: 'SELECT * WHERE { }',
    }
    const suggestions = validateSlots(response, vocabulary).gaps[0]!.suggestions ?? []
    expect(suggestions.some((s) => s.includes('(mediaTypes)'))).toBe(false)
    expect(suggestions.some((s) => s.includes('overtaking'))).toBe(true)
  })

  /**
   * Honest gap reporting: schema-limit gaps (e.g. dropped references)
   * carry `suggestions: []` as a sentinel — the enricher must respect
   * it and NOT append "related concepts" noise. Adding suggestions to
   * a "we can't do this yet" explanation only misleads the reader.
   */
  it('leaves schema-limit gaps alone when they carry the empty-suggestions sentinel', () => {
    const response: LlmStructuredResponse = {
      interpretation: { summary: 'test', mappedTerms: [] },
      gaps: [
        {
          term: 'maps',
          reason: 'Cross-reference to "hdmap" was dropped — schema limit.',
          suggestions: [],
        },
      ],
      sparql: 'SELECT * WHERE { }',
    }

    const result = validateSlots(response, testVocabulary)
    // Stays empty — the enricher saw the array and bailed.
    expect(result.gaps[0]!.suggestions).toEqual([])
  })

  it('preserves country / state / region / city as ordinary filter terms', () => {
    // Task 21d-flat: country (and friends) are no longer a typed slot
    // exception — they flow through `filters` keyed by the SHACL leaf
    // local name. `validateSlots` keeps the mapped value intact (the
    // downstream SHACL gate validates the sh:pattern). Confidence may
    // be downgraded by the fuzzy-property gate when the term is not in
    // the local enum index, but the value itself must not be discarded.
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
    expect(result.interpretation.mappedTerms[0]!.property).toBe('country')
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

  it('keeps a domain that declares the property without enumerating it', () => {
    // Regression: `surfaceType` is enumerated only in `ositrace`; `hdmap`
    // declares it with a plain `sh:datatype` and no `sh:in`, so it is absent
    // from enumProperties/numericProperties for that domain. Deriving the
    // membership test from those lists alone answered "hdmap lacks
    // surfaceType" and widened a precise single-domain query to include
    // `ositrace` — silently searching assets the user never asked for.
    expect(correctDomains(['hdmap'], { surfaceType: 'asphalt' }, {}, testVocabulary)).toEqual([
      'hdmap',
    ])
  })

  it('still redirects a property the chosen domain genuinely lacks', () => {
    // The widening itself is correct when the chosen domain really cannot
    // resolve the property — only the false negative above was wrong.
    expect(correctDomains(['hdmap'], { weatherSummary: 'rain' }, {}, testVocabulary)).toEqual([
      'hdmap',
      'scenario',
    ])
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

  it('never injects a phantom domain for an unattributed (empty-domain) property', () => {
    // The vocabulary extractor emits an empty-string domain when an IRI
    // can't be attributed to any registered namespace. Such a property must
    // not surface as a searchable domain — regression for the
    // `domains: ["hdmap", ""]` / `domain:unknown` artifact.
    const vocabWithOrphan: SchemaVocabulary = {
      ...testVocabulary,
      enumProperties: [
        ...testVocabulary.enumProperties,
        {
          localName: 'orphanProp',
          domain: '', // unresolvable IRI → no domain
          iri: 'https://example.org/external#orphanProp',
          label: 'orphan',
          description: '',
          allowedValues: ['x'],
        },
      ],
      // Present in the attribution map but with no resolvable domain, so the
      // empty-domain guard is what has to reject it.
      propertyDomains: new Map<string, readonly string[]>([
        ...testVocabulary.propertyDomains,
        ['orphanProp', ['']],
      ]),
    }
    const result = correctDomains(['hdmap'], { orphanProp: 'x' }, {}, vocabWithOrphan)
    expect(result).toEqual(['hdmap'])
    expect(result).not.toContain('')
    expect(result).not.toContain('unknown')
  })
})
