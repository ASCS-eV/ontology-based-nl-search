/**
 * A shape-group class reached from the asset by several routes. Each route is
 * a sequence path of its own ([SHACL] §2.3.1.2), so every leaf of the class
 * gets a key per route; the bare leaf name matches every route, with the
 * leaves of the class on one node of each route; and the group's facet lists
 * every route's key. Built with `buildCompilerVocabFrom`, compiled, and run on
 * a real Oxigraph store.
 *
 * `core:` is a second domain so each `fleet:X ⊑ core:X` inheritance
 * classifies the leaves of `X` into a shape group, as the asset metadata
 * meta-model does.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { shapeGroupFacets } from '../metadata-index.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { syntheticRegistry } from './__fixtures__/synthetic-registry.js'

const FLEET = 'http://example.org/fleet/v1/'
const CORE = 'http://example.org/core/v1/'

const PREFIXES = `
@prefix fleet: <${FLEET}> .
@prefix core: <${CORE}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`

const fleetRegistry = () =>
  syntheticRegistry([{ name: 'fleet', namespace: FLEET, assetClass: 'Vehicle' }], { core: CORE })

async function setup(schema: string, data: string) {
  const store = new OxigraphStore()
  await store.loadTurtle(PREFIXES + schema, SCHEMA_GRAPH)
  await store.loadTurtle(PREFIXES + data)
  const registry = fleetRegistry()
  const vocabIndex = await buildCompilerVocabFrom(store, registry as any)
  const assets = async (filters: Record<string, string>) => {
    const { sparql } = await compileSlotsWithTrace(
      { domains: ['fleet'], filters, ranges: {} },
      { registry: registry as any, vocabIndex }
    )
    const rows = (await store.query(sparql)).results.bindings
    return [...new Set(rows.map((row) => row['asset']?.value))].sort()
  }
  const facets = () =>
    shapeGroupFacets(vocabIndex, 'fleet')
      .map(({ group, key }) => `${group} ${key}`)
      .sort()
  return { vocabIndex, assets, facets }
}

// A value class (the shape group) whose leaves end every coded chain: the
// manoeuvre of the ego and of the other road users, and the road type. `code`
// is a bare name for several chains before any further route is counted;
// `reason` only through the further route.
const VALUE_CLASS_SCHEMA = `
core:Coded a owl:Class .
fleet:Vehicle a owl:Class .
fleet:Spec a owl:Class .
fleet:Manoeuvre a owl:Class .
fleet:ManoeuvreType a owl:Class ; rdfs:subClassOf core:Coded .
fleet:RoadType a owl:Class ; rdfs:subClassOf core:Coded .

fleet:VehicleShape a sh:NodeShape ;
  sh:targetClass fleet:Vehicle ;
  sh:property [ sh:path fleet:hasSpec ; sh:node fleet:SpecShape ] .
fleet:SpecShape a sh:NodeShape ;
  sh:targetClass fleet:Spec ;
  sh:property [ sh:path fleet:ego ; sh:node fleet:ManoeuvreShape ] ;
  sh:property [ sh:path fleet:others ; sh:node fleet:ManoeuvreShape ] ;
  sh:property [ sh:path fleet:road ; sh:node fleet:RoadTypeShape ] .
fleet:ManoeuvreShape a sh:NodeShape ;
  sh:targetClass fleet:Manoeuvre ;
  sh:property [ sh:path fleet:kind ; sh:node fleet:ManoeuvreTypeShape ] .
fleet:ManoeuvreTypeShape a sh:NodeShape ;
  sh:targetClass fleet:ManoeuvreType ;
  sh:property [ sh:path fleet:code ; sh:in ( "cut_in" "follow" ) ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] .
fleet:RoadTypeShape a sh:NodeShape ;
  sh:targetClass fleet:RoadType ;
  sh:property [ sh:path fleet:code ; sh:in ( "motorway" "rural" ) ] .
`

const VALUE_CLASS_DATA = `
<urn:vehicle:1> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:ego [ a fleet:Manoeuvre ; fleet:kind [ a fleet:ManoeuvreType ; fleet:code "follow" ] ] ;
  fleet:others [ a fleet:Manoeuvre ;
    fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ; fleet:reason "merge" ] ] ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ] ] .
<urn:vehicle:2> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:ego [ a fleet:Manoeuvre ;
    fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ; fleet:reason "overtake" ] ] ;
  fleet:others [ a fleet:Manoeuvre ; fleet:kind [ a fleet:ManoeuvreType ; fleet:code "follow" ] ] ;
  fleet:road [ a fleet:RoadType ; fleet:code "rural" ] ] .
`

describe('a value class that is the shape group, shared by several contexts', () => {
  it('tells the contexts apart under their own keys', async () => {
    const { assets } = await setup(VALUE_CLASS_SCHEMA, VALUE_CLASS_DATA)
    expect(await assets({ others__kind__code: 'cut_in' })).toEqual(['urn:vehicle:1'])
    expect(await assets({ ego__kind__code: 'cut_in' })).toEqual(['urn:vehicle:2'])
    expect(await assets({ code: 'cut_in' })).toEqual(['urn:vehicle:1', 'urn:vehicle:2'])
  }, 30_000)

  it('keys every leaf of the class on every route, not only the ambiguous one', async () => {
    const { vocabIndex, assets } = await setup(VALUE_CLASS_SCHEMA, VALUE_CLASS_DATA)
    expect(vocabIndex.paths.has('fleet:others__kind__reason')).toBe(true)
    expect(await assets({ others__kind__reason: 'merge' })).toEqual(['urn:vehicle:1'])
  }, 30_000)

  it('keeps the leaves of the class on one node of each route', async () => {
    // Vehicle 2's ego cuts in to overtake and its other road user follows:
    // no manoeuvre of it follows to overtake.
    const { assets } = await setup(VALUE_CLASS_SCHEMA, VALUE_CLASS_DATA)
    expect(await assets({ code: 'cut_in', reason: 'overtake' })).toEqual(['urn:vehicle:2'])
    expect(await assets({ code: 'follow', reason: 'overtake' })).toEqual([])
  }, 30_000)

  it('lists every route of the group in its facet', async () => {
    const { facets } = await setup(VALUE_CLASS_SCHEMA, VALUE_CLASS_DATA)
    expect(facets()).toEqual([
      'Coded ego__kind__code',
      'Coded ego__kind__reason',
      'Coded others__kind__code',
      'Coded others__kind__reason',
      'Coded road__code',
    ])
  }, 30_000)
})

// A group class in the meta-model's shape (asset → spec → group → leaf)
// reached by a second route, and a class no group classifies that has a leaf
// of the same name.
const MIXED_SCHEMA = `
core:Content a owl:Class .
fleet:Vehicle a owl:Class .
fleet:Spec a owl:Class .
fleet:Content a owl:Class ; rdfs:subClassOf core:Content .
fleet:Other a owl:Class .

fleet:VehicleShape a sh:NodeShape ;
  sh:targetClass fleet:Vehicle ;
  sh:property [ sh:path fleet:hasSpec ; sh:node fleet:SpecShape ] .
fleet:SpecShape a sh:NodeShape ;
  sh:targetClass fleet:Spec ;
  sh:property [ sh:path fleet:hasContent ; sh:node fleet:ContentShape ] ;
  sh:property [ sh:path fleet:hasArchive ; sh:node fleet:ContentShape ] ;
  sh:property [ sh:path fleet:hasOther ; sh:node fleet:OtherShape ] .
fleet:ContentShape a sh:NodeShape ;
  sh:targetClass fleet:Content ;
  sh:property [ sh:path fleet:code ; sh:in ( "A" "B" ) ] ;
  sh:property [ sh:path fleet:title ; sh:datatype xsd:string ] .
fleet:OtherShape a sh:NodeShape ;
  sh:targetClass fleet:Other ;
  sh:property [ sh:path fleet:code ; sh:in ( "Z" ) ] .
`

// Vehicle y has code A only on its archive and title T only on its content:
// no Content node of it carries both.
const MIXED_DATA = `
<urn:vehicle:x> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:hasContent [ a fleet:Content ; fleet:code "A" ; fleet:title "T" ] ] .
<urn:vehicle:y> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:hasContent [ a fleet:Content ; fleet:code "B" ; fleet:title "T" ] ;
  fleet:hasArchive [ a fleet:Content ; fleet:code "A" ; fleet:title "U" ] ] .
<urn:vehicle:z> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:hasArchive [ a fleet:Content ; fleet:code "A" ; fleet:title "T" ] ] .
<urn:vehicle:w> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:hasOther [ a fleet:Other ; fleet:code "Z" ] ] .
`

describe('a group class reached by a second route, next to a same-named leaf', () => {
  it('matches group siblings on one node of either route', async () => {
    const { assets } = await setup(MIXED_SCHEMA, MIXED_DATA)
    expect(await assets({ code: 'A', title: 'T' })).toEqual(['urn:vehicle:x', 'urn:vehicle:z'])
  }, 30_000)

  it('keeps the qualified keys of one route on one group node', async () => {
    const { assets } = await setup(MIXED_SCHEMA, MIXED_DATA)
    expect(await assets({ hasArchive__code: 'A', hasArchive__title: 'T' })).toEqual([
      'urn:vehicle:z',
    ])
    expect(await assets({ hasContent__code: 'A', hasContent__title: 'T' })).toEqual([
      'urn:vehicle:x',
    ])
  }, 30_000)

  it('lists the group class on both routes in its facet, and the other class on none', async () => {
    const { facets } = await setup(MIXED_SCHEMA, MIXED_DATA)
    expect(facets()).toEqual([
      'Content hasArchive__code',
      'Content hasArchive__title',
      'Content hasContent__code',
      'Content hasContent__title',
    ])
  }, 30_000)
})
