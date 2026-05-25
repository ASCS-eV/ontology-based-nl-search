import {
  enforceSparqlPolicy,
  registerPolicyNamespaces,
  resetPolicyNamespaces,
} from '@ontology-search/sparql/policy'
import { afterAll, beforeAll, vi } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { compileCountQuery, compileSlots, escapeSparqlLiteral } from '../compiler.js'
import type { SearchSlots } from '../slots.js'

// Register ontology namespaces so compiled queries pass policy validation
beforeAll(() => {
  registerPolicyNamespaces(['https://w3id.org/ascs-ev/envited-x/'])
})
afterAll(() => {
  resetPolicyNamespaces()
})

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

/**
 * Synthesize property paths consistent with the mocked shape-group
 * classification above. The compiler vocabulary now reads triple
 * predicates (asset→DS, DS→group) from these paths instead of
 * hard-coding `hasDomainSpecification` / `has${Group}`.
 *
 * Built mechanically from `(domain, group)` so future test additions
 * to `queryPropertyShapeGroups` are automatically reflected here.
 */
vi.mock('../property-paths.js', () => {
  const properties: { domain: string; propertyName: string; group: string; assetClass: string }[] =
    [
      { domain: 'hdmap', propertyName: 'roadTypes', group: 'Content', assetClass: 'HDMap' },
      { domain: 'hdmap', propertyName: 'laneTypes', group: 'Content', assetClass: 'HDMap' },
      { domain: 'hdmap', propertyName: 'levelOfDetail', group: 'Content', assetClass: 'HDMap' },
      { domain: 'hdmap', propertyName: 'trafficDirection', group: 'Content', assetClass: 'HDMap' },
      { domain: 'hdmap', propertyName: 'formatType', group: 'Format', assetClass: 'HDMap' },
      { domain: 'hdmap', propertyName: 'version', group: 'Format', assetClass: 'HDMap' },
      { domain: 'hdmap', propertyName: 'length', group: 'Quantity', assetClass: 'HDMap' },
      {
        domain: 'hdmap',
        propertyName: 'numberIntersections',
        group: 'Quantity',
        assetClass: 'HDMap',
      },
      {
        domain: 'hdmap',
        propertyName: 'numberTrafficLights',
        group: 'Quantity',
        assetClass: 'HDMap',
      },
      { domain: 'hdmap', propertyName: 'speedLimit', group: 'Quantity', assetClass: 'HDMap' },
      {
        domain: 'hdmap',
        propertyName: 'usedDataSources',
        group: 'DataSource',
        assetClass: 'HDMap',
      },
      {
        domain: 'scenario',
        propertyName: 'scenarioCategory',
        group: 'Content',
        assetClass: 'Scenario',
      },
      {
        domain: 'scenario',
        propertyName: 'weatherSummary',
        group: 'Content',
        assetClass: 'Scenario',
      },
      { domain: 'scenario', propertyName: 'entityTypes', group: 'Content', assetClass: 'Scenario' },
      { domain: 'ositrace', propertyName: 'roadTypes', group: 'Content', assetClass: 'OSITrace' },
    ]
  // Location properties — these go through a deeper path:
  // asset → hasDomainSpecification → hasGeoreference → hasProjectLocation → leaf
  const geoNs = 'https://w3id.org/ascs-ev/envited-x/georeference/v5/'
  const locationProperties = [
    { domain: 'hdmap', propertyName: 'country', assetClass: 'HDMap' },
    { domain: 'hdmap', propertyName: 'city', assetClass: 'HDMap' },
    { domain: 'hdmap', propertyName: 'state', assetClass: 'HDMap' },
    { domain: 'hdmap', propertyName: 'region', assetClass: 'HDMap' },
    { domain: 'scenario', propertyName: 'country', assetClass: 'Scenario' },
    { domain: 'scenario', propertyName: 'city', assetClass: 'Scenario' },
    { domain: 'ositrace', propertyName: 'country', assetClass: 'OSITrace' },
    { domain: 'ositrace', propertyName: 'city', assetClass: 'OSITrace' },
  ]
  const ns = (domain: string) => `https://w3id.org/ascs-ev/envited-x/${domain}/v6/`
  const regularPaths = properties.map(({ domain, propertyName, group, assetClass }) => ({
    domain,
    propertyName,
    propertyIri: ns(domain) + propertyName,
    assetClass: ns(domain) + assetClass,
    steps: [
      {
        predicate: ns(domain) + 'hasDomainSpecification',
        intermediate: ns(domain) + 'DomainSpecification',
      },
      { predicate: ns(domain) + `has${group}`, intermediate: ns(domain) + group },
      { predicate: ns(domain) + propertyName },
    ],
  }))
  const locationPaths = locationProperties.map(({ domain, propertyName, assetClass }) => ({
    domain,
    propertyName,
    propertyIri: geoNs + propertyName,
    assetClass: ns(domain) + assetClass,
    steps: [
      {
        predicate: ns(domain) + 'hasDomainSpecification',
        intermediate: ns(domain) + 'DomainSpecification',
      },
      { predicate: ns(domain) + 'hasGeoreference', intermediate: geoNs + 'Georeference' },
      { predicate: geoNs + 'hasProjectLocation', intermediate: geoNs + 'ProjectLocation' },
      { predicate: geoNs + propertyName },
    ],
  }))
  return {
    buildPropertyPaths: vi.fn().mockResolvedValue([...regularPaths, ...locationPaths]),
  }
})

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
    expect(sparql).toContain('FILTER(CONTAINS(LCASE(STR(?country)), "de"))')
    expect(sparql).toContain('georeference:country ?country')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('matches literal and IRI location values with the same STR-based country filter', async () => {
    const sparql = await compileSlots({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: 'FR' },
    })

    const store = new OxigraphStore()
    await store.loadTurtle(`
        @prefix hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/> .
        @prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        <http://example.org/assets/literal-country> a hdmap:HdMap ;
          rdfs:label "Literal Country" ;
          hdmap:hasDomainSpecification [
            hdmap:hasGeoreference [
              georeference:hasProjectLocation [
                georeference:country "FR"
              ]
            ]
          ] .

        <http://example.org/assets/iri-country> a hdmap:HdMap ;
          rdfs:label "IRI Country" ;
          hdmap:hasDomainSpecification [
            hdmap:hasGeoreference [
              georeference:hasProjectLocation [
                georeference:country <http://example.org/country/FR>
              ]
            ]
          ] .
      `)

    const results = await store.query(sparql)
    expect(results.results.bindings).toHaveLength(2)
    expect(results.results.bindings.map((binding) => binding.asset!.value).sort()).toEqual([
      'http://example.org/assets/iri-country',
      'http://example.org/assets/literal-country',
    ])
  })

  it('filters by multi-country location with IN clause (region expansion)', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      // Express "europe" as the explicit list of ISO codes — the principle is
      // that the LLM (or any caller) supplies a multi-country array and the
      // compiler emits a strict-equality IN clause, NOT CONTAINS.
      location: { country: ['DE', 'FR', 'IT'] },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(LCASE(STR(?country)) IN ("de", "fr", "it"))')
    expect(sparql).not.toContain('CONTAINS(LCASE(STR(?country))')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('collapses a single-element location array to equality', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: ['DE'] },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(LCASE(STR(?country)) = "de")')
  })

  /**
   * R11: The compiler MUST drop range keys unknown to the ontology — same
   * defense as for filters. The original observation: the LLM emitted
   * `numberLanes` as a range, the compiler emitted `?qty hdmap:numberLanes ?n`,
   * the query returned 0 results without any diagnostic.
   */
  it('drops range keys unknown to the ontology (R11 ranges)', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: { numberLanes: { min: 4 } }, // hallucinated property
    }
    const sparql = await compileSlots(slots)
    expect(sparql).not.toContain('numberLanes')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  /**
   * R11: The compiler MUST drop filter keys that are not present in the
   * schema-derived property index. Defense-in-depth — the slot validator
   * should already have caught these, but a bypass shouldn't let a
   * non-existent property reach SPARQL (where it produces 0 results with no
   * diagnostic).
   */
  it('drops filter keys unknown to the ontology (R11)', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { numberLanes: '4' }, // not a real hdmap property
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    // The unknown property MUST NOT appear in the WHERE clause.
    expect(sparql).not.toContain('numberLanes')
    // And the query MUST still be well-formed (no dangling clauses).
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  /**
   * R9: Empty location arrays MUST NOT produce a filter clause in the
   * compiled SPARQL. An empty array carries no information; emitting a
   * dangling pattern would either match nothing or produce a syntax error.
   */
  it('drops empty location arrays from compiled SPARQL (R9)', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { country: [] },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).not.toContain('georeference:country')
    expect(sparql).not.toContain('FILTER(?country')
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
    expect(sparql).toContain('FILTER(CONTAINS(LCASE(STR(?country)), "de"))')
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

  it('handles city with STR-based CONTAINS', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      location: { city: 'Munich' },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('FILTER(CONTAINS(LCASE(STR(?city)), "munich"))')
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

  it('generates reference join for "ositrace referencing hdmap"', async () => {
    const slots: SearchSlots = {
      domains: ['ositrace'],
      filters: {},
      ranges: {},
      references: { domain: 'hdmap' },
    }
    const sparql = await compileSlots(slots)
    // Should join via manifest
    expect(sparql).toContain('ositrace:hasManifest')
    expect(sparql).toContain('manifest:hasReferencedArtifacts')
    expect(sparql).toContain('manifest:iri')
    expect(sparql).toContain('?refAsset a hdmap:HdMap')
    expect(sparql).toContain('?refName')
    // Must have all necessary prefixes
    expect(sparql).toContain('PREFIX manifest:')
    expect(sparql).toContain('PREFIX hdmap:')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('generates reference join with label filter', async () => {
    const slots: SearchSlots = {
      domains: ['ositrace'],
      filters: {},
      ranges: {},
      references: { domain: 'hdmap', label: 'Karlsruhe' },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('manifest:iri ?refAsset')
    expect(sparql).toContain('CONTAINS(LCASE(?refName), "karlsruhe")')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })
})

describe('peer-domain UNION queries', () => {
  it('generates UNION for peer domains with shared filters (hdmap + ositrace)', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap', 'ositrace'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    // Should use UNION, not a JOIN via manifest
    expect(sparql).toContain('UNION')
    // Both domains should have their own arm
    expect(sparql).toContain('hdmap:HdMap')
    expect(sparql).toContain('ositrace:OSITrace')
    // roadTypes filter should appear in both arms
    const roadTypesMatches = sparql.match(/roadTypes/g)
    expect(roadTypesMatches?.length).toBeGreaterThanOrEqual(2)
    // Should NOT have manifest join (peer domains, not parent-child)
    expect(sparql).not.toContain('manifest:hasReferencedArtifacts')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('generates UNION with location filter applied to both arms', async () => {
    const slots: SearchSlots = {
      domains: ['hdmap', 'ositrace'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
      location: { country: 'FR' },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('UNION')
    expect(sparql).toContain('hdmap:HdMap')
    expect(sparql).toContain('ositrace:OSITrace')
    // Location filter should be present (in one or both arms)
    expect(sparql).toContain('country')
    expect(sparql.toLowerCase()).toContain('fr')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('still uses hierarchy JOIN for scenario + hdmap', async () => {
    const slots: SearchSlots = {
      domains: ['scenario', 'hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    // scenario references hdmap — should be a JOIN, not UNION
    expect(sparql).not.toContain('UNION')
    expect(sparql).toContain('scenario:Scenario')
    expect(sparql).toContain('manifest:hasReferencedArtifacts')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('skips UNION arms for domains with no applicable filters (Bug #1 regression)', async () => {
    // automotive-simulator has no roadTypes property — should be skipped
    const slots: SearchSlots = {
      domains: ['hdmap', 'ositrace', 'automotive-simulator'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('UNION')
    expect(sparql).toContain('hdmap:HdMap')
    expect(sparql).toContain('ositrace:OSITrace')
    // automotive-simulator should be skipped since it has no applicable filters
    expect(sparql).not.toContain('automotive-simulator:AutomotiveSimulator')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('skips UNION arms for domains with no applicable location path (Bug #1 location variant)', async () => {
    // automotive-simulator has no georeference path — should be skipped
    // even when location is the only constraint
    const slots: SearchSlots = {
      domains: ['hdmap', 'ositrace', 'automotive-simulator'],
      filters: {},
      ranges: {},
      location: { country: 'DE' },
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('UNION')
    expect(sparql).toContain('hdmap:HdMap')
    expect(sparql).toContain('ositrace:OSITrace')
    expect(sparql).not.toContain('automotive-simulator:AutomotiveSimulator')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })
})

describe('domain name normalization (Bug #2 regression)', () => {
  it('normalizes "Environment Model" to "environment-model"', async () => {
    const slots: SearchSlots = {
      domains: ['Environment Model'],
      filters: {},
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    // Should not throw — domain name is normalized
    expect(sparql).toContain('environment-model:EnvironmentModel')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('normalizes PascalCase "EnvironmentModel" to "environment-model"', async () => {
    const slots: SearchSlots = {
      domains: ['EnvironmentModel'],
      filters: {},
      ranges: {},
    }
    const sparql = await compileSlots(slots)
    expect(sparql).toContain('environment-model:EnvironmentModel')
    const policy = enforceSparqlPolicy(sparql)
    expect(policy.allowed).toBe(true)
  })

  it('normalizes "HD Map" to "hdmap" style', async () => {
    const slots: SearchSlots = {
      domains: ['HD Map'],
      filters: {},
      ranges: {},
    }
    // "hd-map" won't match "hdmap" in registry, but it should not crash.
    // The normalized form "hd-map" may not exist, but the error message should
    // be about an unknown domain, not an unhandled exception.
    await expect(compileSlots(slots)).rejects.toThrow(/Unknown domain/)
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
