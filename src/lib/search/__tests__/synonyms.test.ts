import { extractKnownTerms, getAllowedValues } from '../synonyms'

describe('extractKnownTerms', () => {
  it('extracts country from query', () => {
    const { terms, remainder } = extractKnownTerms('I need a German highway map')
    expect(terms).toContainEqual({
      original: 'german',
      property: 'georeference:country',
      value: 'DE',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'highway',
      property: 'hdmap:roadTypes',
      value: 'motorway',
      confidence: 'high',
    })
    expect(remainder).not.toContain('german')
    expect(remainder).not.toContain('highway')
  })

  it('extracts format names', () => {
    const { terms } = extractKnownTerms('OpenDRIVE roundabout in France')
    expect(terms).toContainEqual({
      original: 'opendrive',
      property: 'hdmap:formatType',
      value: 'ASAM OpenDRIVE',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'roundabout',
      property: 'hdmap:roadTypes',
      value: 'roundabout',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'france',
      property: 'georeference:country',
      value: 'FR',
      confidence: 'high',
    })
  })

  it('handles multi-word terms (united states, south korea)', () => {
    const { terms } = extractKnownTerms('map from United States')
    expect(terms).toContainEqual({
      original: 'united states',
      property: 'georeference:country',
      value: 'US',
      confidence: 'high',
    })
  })

  it('returns remainder with unmatched terms', () => {
    const { terms, remainder } = extractKnownTerms('German autobahn with many traffic lights')
    expect(terms).toHaveLength(2) // german + autobahn
    expect(remainder).toContain('many traffic lights')
  })

  it('extracts data source terms', () => {
    const { terms } = extractKnownTerms('lidar-scanned road')
    expect(terms).toContainEqual({
      original: 'lidar',
      property: 'hdmap:usedDataSources',
      value: 'lidar',
      confidence: 'high',
    })
  })

  it('handles empty query', () => {
    const { terms, remainder } = extractKnownTerms('')
    expect(terms).toHaveLength(0)
    expect(remainder).toBe('')
  })

  it('is case insensitive', () => {
    const { terms } = extractKnownTerms('JAPANESE MOTORWAY')
    expect(terms).toContainEqual({
      original: 'japanese',
      property: 'georeference:country',
      value: 'JP',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'motorway',
      property: 'hdmap:roadTypes',
      value: 'motorway',
      confidence: 'high',
    })
  })
})

describe('getAllowedValues', () => {
  it('returns unique country codes', () => {
    const values = getAllowedValues('georeference:country')
    expect(values).toContain('DE')
    expect(values).toContain('US')
    // Should be unique
    expect(new Set(values).size).toBe(values.length)
  })

  it('returns road types', () => {
    const values = getAllowedValues('hdmap:roadTypes')
    expect(values).toContain('motorway')
    expect(values).toContain('roundabout')
  })

  it('returns empty for unknown property', () => {
    expect(getAllowedValues('unknown:prop')).toHaveLength(0)
  })
})
