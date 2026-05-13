import { enforceSparqlPolicy } from '@ontology-search/sparql/policy'
import { vi } from 'vitest'

import { compileCountQuery, compileSlots, escapeSparqlLiteral } from '../compiler.js'
import type { SearchSlots } from '../slots.js'

// Mock the schema query functions to provide test data
vi.mock('../schema-queries.js', () => ({
  queryPropertyDomains: vi.fn().mockResolvedValue([
    {
      localName: 'roadTypes',
      domain: 'hdmap',
      iri: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/roadTypes',
      targetClass: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/HDMap',
    },
    {
      localName: 'roadTypes',
      domain: 'ositrace',
      iri: 'https://w3id.org/ascs-ev/envited-x/ositrace/v6/roadTypes',
      targetClass: 'https://w3id.org/ascs-ev/envited-x/ositrace/v6/OSITrace',
    },
    {
      localName: 'laneTypes',
      domain: 'hdmap',
      iri: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/laneTypes',
      targetClass: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/HDMap',
    },
    {
      localName: 'formatType',
      domain: 'hdmap',
      iri: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/formatType',
      targetClass: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/HDMap',
    },
    {
      localName: 'scenarioCategory',
      domain: 'scenario',
      iri: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/scenarioCategory',
      targetClass: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/Scenario',
    },
    {
      localName: 'weatherSummary',
      domain: 'scenario',
      iri: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/weatherSummary',
      targetClass: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/Scenario',
    },
    {
      localName: 'entityTypes',
      domain: 'scenario',
      iri: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/entityTypes',
      targetClass: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/Scenario',
    },
  ]),
  queryAssetDomains: vi.fn().mockResolvedValue([
    { domainName: 'hdmap', assetClass: 'https://w3id.org/ascs-ev/envited-x/hdmap/v6/HDMap' },
    {
      domainName: 'scenario',
      assetClass: 'https://w3id.org/ascs-ev/envited-x/scenario/v6/Scenario',
    },
    {
      domainName: 'ositrace',
      assetClass: 'https://w3id.org/ascs-ev/envited-x/ositrace/v6/OSITrace',
    },
  ]),
  queryDomainReferences: vi.fn().mockResolvedValue([
    { parentDomain: 'scenario', childDomain: 'hdmap' },
    { parentDomain: 'scenario', childDomain: 'environment-model' },
  ]),
  queryPropertyShapeGroups: vi.fn().mockResolvedValue([
    { localName: 'roadTypes', domain: 'hdmap', shapeGroup: 'Content' },
    { localName: 'laneTypes', domain: 'hdmap', shapeGroup: 'Content' },
    { localName: 'levelOfDetail', domain: 'hdmap', shapeGroup: 'Content' },
    { localName: 'trafficDirection', domain: 'hdmap', shapeGroup: 'Content' },
    { localName: 'formatType', domain: 'hdmap', shapeGroup: 'Format' },
    { localName: 'version', domain: 'hdmap', shapeGroup: 'Format' },
    { localName: 'length', domain: 'hdmap', shapeGroup: 'Quantity' },
    { localName: 'numberIntersections', domain: 'hdmap', shapeGroup: 'Quantity' },
    { localName: 'numberTrafficLights', domain: 'hdmap', shapeGroup: 'Quantity' },
    { localName: 'speedLimit', domain: 'hdmap', shapeGroup: 'Quantity' },
    { localName: 'usedDataSources', domain: 'hdmap', shapeGroup: 'DataSource' },
    { localName: 'scenarioCategory', domain: 'scenario', shapeGroup: 'Content' },
    { localName: 'weatherSummary', domain: 'scenario', shapeGroup: 'Content' },
    { localName: 'entityTypes', domain: 'scenario', shapeGroup: 'Content' },
  ]),
  queryRange2DProperties: vi.fn().mockResolvedValue([{ localName: 'speedLimit', domain: 'hdmap' }]),
}))

// Mock the store init (not needed since we mock extractVocabulary)
vi.mock('../init.js', () => ({
  getInitializedStore: vi.fn().mockResolvedValue({}),
}))

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
    expect(sparql).toContain('FILTER(CONTAINS(LCASE(?country), "de"))')
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
    expect(sparql).toContain('FILTER(CONTAINS(LCASE(?country), "de"))')
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

  it('generates cross-domain query for scenario + hdmap', async () => {
    const slots: SearchSlots = {
      domains: ['scenario', 'hdmap'],
      filters: { scenarioCategory: 'lane-change', roadTypes: 'motorway' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    // Primary domain is scenario (it references hdmap)
    expect(sparql).toContain('?asset a scenario:Scenario')
    expect(sparql).toContain('FILTER(?scenarioCategory')
    // Cross-domain join to hdmap
    expect(sparql).toContain('manifest:hasReferencedArtifacts')
    expect(sparql).toContain('hdmap:HdMap')
    expect(sparql).toContain('FILTER(?roadTypes')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
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

describe('escapeSparqlLiteral', () => {
  it('passes through clean strings unchanged', () => {
    expect(escapeSparqlLiteral('motorway')).toBe('motorway')
    expect(escapeSparqlLiteral('ASAM OpenDRIVE')).toBe('ASAM OpenDRIVE')
  })

  it('escapes double quotes', () => {
    expect(escapeSparqlLiteral('value"injection')).toBe('value\\"injection')
  })

  it('escapes backslashes', () => {
    expect(escapeSparqlLiteral('path\\to')).toBe('path\\\\to')
  })

  it('escapes newlines and tabs', () => {
    expect(escapeSparqlLiteral('line1\nline2')).toBe('line1\\nline2')
    expect(escapeSparqlLiteral('col1\tcol2')).toBe('col1\\tcol2')
    expect(escapeSparqlLiteral('line\r\n')).toBe('line\\r\\n')
  })

  it('prevents SPARQL injection via filter breakout', () => {
    const malicious = '" ) . ?s ?p ?o } # '
    const escaped = escapeSparqlLiteral(malicious)
    expect(escaped).not.toContain('")') // Must not break out of the literal
    expect(escaped).toBe('\\" ) . ?s ?p ?o } # ')
  })

  it('handles combined special characters', () => {
    const input = 'val"ue\\with\nnewline'
    expect(escapeSparqlLiteral(input)).toBe('val\\"ue\\\\with\\nnewline')
  })
})
