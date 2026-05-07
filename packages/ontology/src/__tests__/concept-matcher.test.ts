import { jaroWinklerDistance, matchConcepts, resetConceptMatcher } from '../concept-matcher.js'
import { resetVocabularyIndex } from '../vocabulary-index.js'

describe('jaroWinklerDistance', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroWinklerDistance('motorway', 'motorway')).toBe(1.0)
  })

  it('returns 0.0 for completely different strings', () => {
    expect(jaroWinklerDistance('abc', 'xyz')).toBe(0.0)
  })

  it('returns high score for similar strings', () => {
    expect(jaroWinklerDistance('motorway', 'motorwa')).toBeGreaterThan(0.9)
  })

  it('returns lower score for loosely related strings', () => {
    const score = jaroWinklerDistance('exit', 'motorway')
    expect(score).toBeLessThan(0.7)
  })

  it('handles empty strings', () => {
    expect(jaroWinklerDistance('', 'abc')).toBe(0.0)
    expect(jaroWinklerDistance('abc', '')).toBe(0.0)
    expect(jaroWinklerDistance('', '')).toBe(1.0)
  })
})

describe('matchConcepts', () => {
  beforeEach(() => {
    resetConceptMatcher()
    resetVocabularyIndex()
  })

  it('matches "German" to country DE via SKOS altLabel', async () => {
    const result = await matchConcepts('I want a German highway')

    const countryMatch = result.matches.find((m) => m.property === 'country')
    expect(countryMatch).toBeDefined()
    expect(countryMatch!.value).toBe('DE')
    expect(countryMatch!.confidence).toBe('high')
  })

  it('matches "highway" to roadTypes motorway via SKOS altLabel', async () => {
    const result = await matchConcepts('I want a German highway')

    const roadMatch = result.matches.find((m) => m.property === 'roadTypes')
    expect(roadMatch).toBeDefined()
    expect(roadMatch!.value).toBe('motorway')
    expect(roadMatch!.confidence).toBe('high')
  })

  it('matches "exit" directly to laneTypes exit via SKOS prefLabel', async () => {
    const result = await matchConcepts('German Autobahn with exit')

    const exitMatch = result.matches.find(
      (m) => m.value === 'exit' || m.value === 'mwyExit' || m.value === 'offRamp'
    )
    expect(exitMatch).toBeDefined()
    expect(exitMatch!.property).toBe('laneTypes')
    expect(exitMatch!.confidence).toBe('high')
  })

  it('matches "OpenDRIVE" to formatType via SKOS altLabel', async () => {
    const result = await matchConcepts('OpenDRIVE roundabout data')

    const formatMatch = result.matches.find((m) => m.property === 'formatType')
    expect(formatMatch).toBeDefined()
    expect(formatMatch!.value).toBe('ASAM OpenDRIVE')
  })

  it('matches multi-word phrases like "United States"', async () => {
    const result = await matchConcepts('maps from United States')

    const countryMatch = result.matches.find((m) => m.property === 'country')
    expect(countryMatch).toBeDefined()
    expect(countryMatch!.value).toBe('US')
  })

  it('ignores stopwords in query', async () => {
    const result = await matchConcepts('I want a map with data')
    expect(result.matches).toHaveLength(0)
    expect(result.gaps).toHaveLength(0)
  })

  it('reports gaps for completely unmapped terms', async () => {
    const result = await matchConcepts('show me weather simulation')

    const weatherGap = result.gaps.find((g) => g.term === 'weather')
    expect(weatherGap).toBeDefined()
    expect(weatherGap!.reason).toBeDefined()
    expect(weatherGap!.reason.length).toBeGreaterThan(0)
  })

  it('handles on-ramp as a valid lane type concept', async () => {
    const result = await matchConcepts('highway with on-ramp')

    const rampMatch = result.matches.find(
      (m) => m.value === 'onRamp' || m.value === 'connectingRamp'
    )
    expect(rampMatch).toBeDefined()
    expect(rampMatch!.property).toBe('laneTypes')
  })
})
