import { extractKnownTerms, getAllowedValues, detectGaps } from '../synonyms'

describe('extractKnownTerms', () => {
  it('extracts country from query', () => {
    const { terms, remainder } = extractKnownTerms('I need a German highway map')
    expect(terms).toContainEqual({
      original: 'german',
      property: 'country',
      value: 'DE',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'highway',
      property: 'roadType',
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
      property: 'formatType',
      value: 'ASAM OpenDRIVE',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'roundabout',
      property: 'roadType',
      value: 'roundabout',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'france',
      property: 'country',
      value: 'FR',
      confidence: 'high',
    })
  })

  it('handles multi-word terms (united states, south korea)', () => {
    const { terms } = extractKnownTerms('map from United States')
    expect(terms).toContainEqual({
      original: 'united states',
      property: 'country',
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
      property: 'dataSource',
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
      property: 'country',
      value: 'JP',
      confidence: 'high',
    })
    expect(terms).toContainEqual({
      original: 'motorway',
      property: 'roadType',
      value: 'motorway',
      confidence: 'high',
    })
  })
})

describe('getAllowedValues', () => {
  it('returns unique country codes', () => {
    const values = getAllowedValues('country')
    expect(values).toContain('DE')
    expect(values).toContain('US')
    // Should be unique
    expect(new Set(values).size).toBe(values.length)
  })

  it('returns road types', () => {
    const values = getAllowedValues('roadType')
    expect(values).toContain('motorway')
    expect(values).toContain('roundabout')
  })

  it('returns empty for unknown property', () => {
    expect(getAllowedValues('unknown:prop')).toHaveLength(0)
  })
})

describe('detectGaps', () => {
  it('detects "exit" as a near-miss for intersection', () => {
    const gaps = detectGaps('with exit')
    expect(gaps).toHaveLength(1)
    expect(gaps[0].term).toBe('exit')
    expect(gaps[0].suggestions).toContain('intersection')
  })

  it('detects "ramp" as a near-miss for intersection', () => {
    const gaps = detectGaps('on-ramp connection')
    expect(gaps).toContainEqual(
      expect.objectContaining({ term: 'on-ramp', suggestions: ['intersection'] })
    )
  })

  it('ignores stopwords', () => {
    const gaps = detectGaps('i want a with the')
    expect(gaps).toHaveLength(0)
  })

  it('returns empty for empty remainder', () => {
    expect(detectGaps('')).toHaveLength(0)
    expect(detectGaps('   ')).toHaveLength(0)
  })

  it('detects multiple gaps', () => {
    const gaps = detectGaps('exit and tunnel nearby')
    expect(gaps.length).toBeGreaterThanOrEqual(2)
    const terms = gaps.map((g) => g.term)
    expect(terms).toContain('exit')
    expect(terms).toContain('tunnel')
  })

  it('does not flag words shorter than 3 characters', () => {
    const gaps = detectGaps('at to in')
    expect(gaps).toHaveLength(0)
  })

  it('works with full extraction pipeline', () => {
    const { remainder } = extractKnownTerms('I want a German Autobahn with exit')
    const gaps = detectGaps(remainder)
    expect(gaps).toContainEqual(
      expect.objectContaining({ term: 'exit', suggestions: ['intersection'] })
    )
  })
})
