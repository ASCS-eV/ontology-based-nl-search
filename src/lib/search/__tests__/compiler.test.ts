import { compileSlots } from '../compiler'
import { enforceSparqlPolicy } from '@/lib/sparql/policy'

describe('compileSlots', () => {
  it('generates minimal query with no slots', () => {
    const sparql = compileSlots({})
    expect(sparql).toContain('SELECT ?asset ?name')
    expect(sparql).toContain('?asset a hdmap:HdMap')
    expect(sparql).toContain('rdfs:label ?name')
    expect(sparql).toContain('LIMIT 100')
    // Should pass policy
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('filters by country', () => {
    const sparql = compileSlots({ country: 'DE' })
    expect(sparql).toContain('FILTER(?country = "DE")')
    expect(sparql).toContain('georeference:country ?country')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('filters by road type', () => {
    const sparql = compileSlots({ roadType: 'motorway' })
    expect(sparql).toContain('FILTER(?roadTypes = "motorway")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('combines multiple filters', () => {
    const sparql = compileSlots({
      country: 'DE',
      roadType: 'motorway',
      formatType: 'ASAM OpenDRIVE',
    })
    expect(sparql).toContain('FILTER(?country = "DE")')
    expect(sparql).toContain('FILTER(?roadTypes = "motorway")')
    expect(sparql).toContain('FILTER(?formatType = "ASAM OpenDRIVE")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles numeric quantity filters', () => {
    const sparql = compileSlots({
      minLength: 5,
      minTrafficLights: 10,
    })
    expect(sparql).toContain('FILTER(xsd:float(?length) >= 5)')
    expect(sparql).toContain('FILTER(xsd:integer(?numTrafficLights) >= 10)')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles city with case-insensitive CONTAINS', () => {
    const sparql = compileSlots({ city: 'Munich' })
    expect(sparql).toContain('FILTER(CONTAINS(LCASE(?city), "munich"))')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles format version', () => {
    const sparql = compileSlots({
      formatType: 'ASAM OpenDRIVE',
      formatVersion: '1.6',
    })
    expect(sparql).toContain('FILTER(?formatType = "ASAM OpenDRIVE")')
    expect(sparql).toContain('FILTER(?formatVersion = "1.6")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles data source filter', () => {
    const sparql = compileSlots({ dataSource: 'lidar' })
    expect(sparql).toContain('FILTER(?dataSrc = "lidar")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles speed limit filters', () => {
    const sparql = compileSlots({ minSpeedLimit: 30, maxSpeedLimit: 130 })
    expect(sparql).toContain('FILTER(xsd:float(?speedMin) >= 30)')
    expect(sparql).toContain('FILTER(xsd:float(?speedMax) <= 130)')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('always passes SPARQL policy validation', () => {
    // Comprehensive test with all slots filled
    const sparql = compileSlots({
      country: 'JP',
      roadType: 'town',
      laneType: 'driving',
      levelOfDetail: 'full',
      trafficDirection: 'left-hand',
      formatType: 'Lanelet2',
      formatVersion: '1.0',
      dataSource: 'lidar',
      city: 'Tokyo',
      minLength: 2,
      minIntersections: 5,
    })
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })
})
