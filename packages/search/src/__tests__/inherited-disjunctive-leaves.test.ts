/**
 * Leaves the discovery used to miss, on a real Oxigraph store:
 *
 *  1. Inherited at an intermediate class — the asset reaches a node of class
 *     `SceneryTag`, and the property lives on the shape targeting its
 *     superclass `Tag` ([SHACL] §2.1.3.2: a class target covers subclass
 *     instances).
 *  2. Disjunctive — the property shape is an `sh:or` of "an integer" or "a
 *     range node" ([SHACL] §4.6.3), so it had no top-level `sh:datatype` and
 *     was neither a leaf nor numeric.
 *
 * The fixture mirrors how a tagging vocabulary is commonly reused inside an
 * asset shape (a content item that is either the asset's own content or a
 * tag), in a neutral namespace so no real ontology name enters the test.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { extractNumericProperties } from '../numeric-properties.js'
import { buildPropertyPaths } from '../property-paths.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'

const NS = 'http://example.org/fleet/v1/'

const SCHEMA_TTL = `
@prefix fleet: <${NS}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

fleet:Vehicle a owl:Class .
fleet:Engine a owl:Class .
fleet:Tag a owl:Class .
fleet:SceneryTag a owl:Class ; rdfs:subClassOf fleet:Tag .
fleet:Range a owl:Class .
fleet:LaneRange a owl:Class .

fleet:VehicleShape a sh:NodeShape ;
  sh:targetClass fleet:Vehicle ;
  sh:property [ sh:path fleet:name ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:hasPart ; sh:node fleet:PartOrTagShape ] .

# A part is either an engine or a scenery tag.
fleet:PartOrTagShape a sh:NodeShape ;
  sh:or ( [ sh:node fleet:EngineShape ] [ sh:node fleet:SceneryTagShape ] ) .

# Reached directly: holds a disjunctive property of its own (cause 2 alone).
fleet:EngineShape a sh:NodeShape ;
  sh:targetClass fleet:Engine ;
  sh:property [ sh:path fleet:fuel ; sh:in ( "diesel" "electric" ) ] ;
  sh:property [ sh:path fleet:rating ; sh:datatype xsd:integer ] ;
  sh:property [
    sh:path fleet:power ;
    sh:or ( [ sh:datatype xsd:integer ] [ sh:class fleet:Range ; sh:node fleet:RangeShape ] )
  ] .

# Reached, but declares nothing: its constraints live on the superclass shape.
fleet:SceneryTagShape a sh:NodeShape ; sh:targetClass fleet:SceneryTag .

fleet:TagShape a sh:NodeShape ;
  sh:targetClass fleet:Tag ;
  # Plain leaf, reachable only through inheritance (cause 1 alone).
  sh:property [ sh:path fleet:colour ; sh:datatype xsd:string ] ;
  # Both causes at once.
  sh:property [
    sh:path fleet:laneCount ;
    sh:name "lane count" ;
    sh:description "Number of lanes." ;
    sh:or (
      [ sh:datatype xsd:integer ; sh:minInclusive 1 ]
      [ sh:class fleet:LaneRange ; sh:node fleet:LaneRangeShape ]
    )
  ] ;
  # Also declared plainly on the engine: that path must stay the only one.
  sh:property [ sh:path fleet:rating ; sh:or ( [ sh:datatype xsd:integer ] [ sh:datatype xsd:float ] ) ] ;
  # A number or a string: a leaf, but a range filter would drop the strings.
  sh:property [ sh:path fleet:surface ; sh:or ( [ sh:datatype xsd:integer ] [ sh:datatype xsd:string ] ) ] .

fleet:RangeShape a sh:NodeShape ;
  sh:targetClass fleet:Range ;
  sh:property [ sh:path fleet:minValue ; sh:datatype xsd:integer ] .

fleet:LaneRangeShape a sh:NodeShape ;
  sh:targetClass fleet:LaneRange ;
  sh:property [ sh:path fleet:minLanes ; sh:datatype xsd:integer ] .
`

const DATA_TTL = `
@prefix fleet: <${NS}> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<urn:vehicle:wide> a fleet:Vehicle ; rdfs:label "Wide" ;
  fleet:hasPart [ a fleet:SceneryTag ; fleet:laneCount 3 ] .
<urn:vehicle:narrow> a fleet:Vehicle ; rdfs:label "Narrow" ;
  fleet:hasPart [ a fleet:SceneryTag ; fleet:laneCount 1 ] .
`

/** The minimum DomainRegistry surface the discovery and compiler read. */
function fleetRegistry() {
  const desc = {
    name: 'fleet',
    namespace: NS,
    prefix: 'fleet',
    targetClass: 'fleet:Vehicle',
    targetClassIri: `${NS}Vehicle`,
    version: 'v1',
    shapes: ['Vehicle'],
    declaredPrefixes: { fleet: NS },
  }
  return {
    domains: new Map([['fleet', desc]]),
    domainNames: ['fleet'],
    prefixesFor() {
      return [
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
        `PREFIX fleet: <${NS}>`,
      ].join('\n')
    },
    allPrefixes() {
      return this.prefixesFor()
    },
    resolveByIriDomain(iriDomain: string) {
      return iriDomain === 'fleet' ? desc : undefined
    },
    domainForIri(iri: string) {
      return iri.startsWith(NS) ? 'fleet' : undefined
    },
    getAllNamespaces() {
      return new Set([NS])
    },
  }
}

async function loadStore(): Promise<OxigraphStore> {
  const store = new OxigraphStore()
  await store.loadTurtle(SCHEMA_TTL, SCHEMA_GRAPH)
  await store.loadTurtle(DATA_TTL)
  return store
}

const localName = (iri: string) => iri.slice(NS.length)

/** One store and one discovery for the whole suite (Oxigraph WASM is slow to start). */
let discovered: Awaited<ReturnType<typeof runDiscovery>>

async function runDiscovery() {
  const store = await loadStore()
  // `as any`: the synthetic registry stands in for the disk-derived
  // DomainRegistry, as in the flat-ontology genericity tests.
  const registry = fleetRegistry() as any
  const paths = await buildPropertyPaths(store, registry)
  const byName = new Map(paths.map((p) => [p.propertyName, p]))
  return { store, registry, paths, byName }
}

beforeAll(async () => {
  discovered = await runDiscovery()
}, 30_000)

const discover = async () => discovered

describe('leaves inherited at an intermediate class, and disjunctive leaves', () => {
  it('reaches a leaf declared on the superclass of an intermediate class', async () => {
    const { byName } = await discover()
    const colour = byName.get('colour')
    expect(colour?.steps.map((s) => localName(s.predicate))).toEqual(['hasPart', 'colour'])
    expect(colour?.steps[0]?.intermediate).toBe(`${NS}SceneryTag`)
  }, 30_000)

  it('treats an sh:or with a datatype member as a literal leaf', async () => {
    const { byName } = await discover()
    expect(byName.get('power')?.steps.map((s) => localName(s.predicate))).toEqual([
      'hasPart',
      'power',
    ])
    expect(byName.get('power')?.leafKind).toBe('literal')
  }, 30_000)

  it('reaches a disjunctive leaf on an inherited shape, and the range node behind it', async () => {
    const { byName } = await discover()
    expect(byName.get('laneCount')?.steps.map((s) => localName(s.predicate))).toEqual([
      'hasPart',
      'laneCount',
    ])
    // The other member is a sub-resource: the property is an edge as well.
    expect(byName.get('minLanes')?.steps.map((s) => localName(s.predicate))).toEqual([
      'hasPart',
      'laneCount',
      'minLanes',
    ])
  }, 30_000)

  it('leaves the paths of directly declared leaves as they were', async () => {
    const { byName } = await discover()
    expect(byName.get('name')?.steps.map((s) => localName(s.predicate))).toEqual(['name'])
    expect(byName.get('fuel')?.steps.map((s) => localName(s.predicate))).toEqual([
      'hasPart',
      'fuel',
    ])
  }, 30_000)

  it('never lets a newly discoverable path displace one the plain discovery finds', async () => {
    const { paths } = await discover()
    // The compiler keeps one path per (domain, property), the last one
    // winning; the inherited, disjunctive declaration must not be that one.
    const rating = paths.filter((p) => p.propertyName === 'rating')
    expect(rating).toHaveLength(1)
    expect(rating[0]?.steps[0]?.intermediate).toBe(`${NS}Engine`)
  }, 30_000)

  it('reads a numeric datatype from sh:or members, but not from a mixed disjunction', async () => {
    const { store, paths } = await discover()
    const domainsByPropertyIri = new Map(paths.map((p) => [p.propertyIri, new Set([p.domain])]))
    const numeric = await extractNumericProperties(store, domainsByPropertyIri)
    const byName = new Map(numeric.map((p) => [p.localName, p]))

    expect(byName.get('laneCount')).toMatchObject({
      datatype: 'integer',
      label: 'lane count',
      description: 'Number of lanes.',
      domain: 'fleet',
    })
    expect(byName.get('power')?.datatype).toBe('integer')
    expect(byName.get('minValue')?.datatype).toBe('integer')
    expect(byName.has('surface')).toBe(false)
    expect(byName.has('colour')).toBe(false)
  }, 30_000)

  it('compiles a range on the inherited disjunctive leaf and finds only the matching asset', async () => {
    const { store, registry } = await discover()
    const vocabIndex = await buildCompilerVocabFrom(store, registry)

    const { sparql } = await compileSlotsWithTrace(
      { domains: ['fleet'], filters: {}, ranges: { laneCount: { min: 3 } } },
      { registry, vocabIndex }
    )

    const result = await store.query(sparql)
    const assets = new Set(result.results.bindings.map((row) => row['asset']?.value))
    expect([...assets]).toEqual(['urn:vehicle:wide'])
  }, 30_000)
})
