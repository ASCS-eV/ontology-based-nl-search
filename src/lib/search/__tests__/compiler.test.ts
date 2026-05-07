import { enforceSparqlPolicy } from '@/lib/sparql/policy'

import { compileCountQuery, compileSlots } from '../compiler'
import type { SearchSlots } from '../slots'

describe('compileSlots', () => {
  it('generates minimal query with empty slots', async () => {
    const slots: SearchSlots = { domains: ['hdmap'], filters: {}, ranges: {} }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('SELECT ?asset ?name')
    expect(sparql).toContain('?asset a hdmap:HdMap')
    expect(sparql).toContain('rdfs:label ?name')
    expect(sparql).toContain('LIMIT 100')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('filters by country via location', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: 'DE' },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(?country = "DE")')
    expect(sparql).toContain('georeference:country ?country')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('filters by enum property', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(?roadTypes = "motorway")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('combines multiple filters', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway', formatType: 'ASAM OpenDRIVE' },
      ranges: {},
      location: { country: 'DE' },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(?country = "DE")')
    expect(sparql).toContain('FILTER(?roadTypes = "motorway")')
    expect(sparql).toContain('FILTER(?formatType = "ASAM OpenDRIVE")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles numeric range filters', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: { length: { min: 5 }, numberTrafficLights: { min: 10 } },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(xsd:float(?length) >= 5)')
    expect(sparql).toContain('FILTER(xsd:float(?numberTrafficLights) >= 10)')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles city with case-insensitive CONTAINS', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { city: 'Munich' },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(CONTAINS(LCASE(?city), "munich"))')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles format properties', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { formatType: 'ASAM OpenDRIVE', version: '1.6' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(?formatType = "ASAM OpenDRIVE")')
    expect(sparql).toContain('FILTER(?version = "1.6")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles data source filter', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { usedDataSources: 'lidar' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(?usedDataSources = "lidar")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('compiles scenario domain query', async () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: { scenarioCategory: 'cut-in', weatherSummary: 'rain' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('?asset a scenario:Scenario')
    expect(sparql).toContain('FILTER(?scenarioCategory = "cut-in")')
    expect(sparql).toContain('FILTER(?weatherSummary = "rain")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('handles array values with IN filter', async () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: { entityTypes: ['car', 'truck', 'pedestrian'] },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(?entityTypes IN ("car", "truck", "pedestrian"))')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('always passes SPARQL policy validation', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {
        roadTypes: 'town',
        laneTypes: 'driving',
        trafficDirection: 'left-hand',
        formatType: 'Lanelet2',
      },
      ranges: { length: { min: 2 }, numberIntersections: { min: 5 } },
      location: { country: 'JP', city: 'Tokyo' },
    }
    const sparql = await compileSlots(slots)
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('throws for unknown domain', async () => {
    const slots: SearchSlots = { domains: ['nonexistent'], filters: {}, ranges: {} }
    await expect(compileSlots(slots)).rejects.toThrow('Unknown domain: nonexistent')
  })
})

describe('compileCountQuery', () => {
  it('generates count query for hdmap', async () => {
    const query = await compileCountQuery('hdmap')
    expect(query).toContain('COUNT(DISTINCT ?asset)')
    expect(query).toContain('hdmap:HdMap')
  })

  it('generates count query for scenario', async () => {
    const query = await compileCountQuery('scenario')
    expect(query).toContain('COUNT(DISTINCT ?asset)')
    expect(query).toContain('scenario:Scenario')
  })

  it('throws for unknown domain', async () => {
    await expect(compileCountQuery('nonexistent')).rejects.toThrow('Unknown domain')
  })
})
