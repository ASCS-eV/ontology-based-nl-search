/**
 * Bare ambiguous names (ADR 0009) that can end on a common node hold on one
 * node of each largest set of them that shares one (`groupConstraints`),
 * compiled and run on a real Oxigraph store. A value node is one thing: a
 * cut-in on one node and the reason "overtake" on another are no cut-in for
 * overtaking.
 *
 * `core:` is a second namespace so each `fleet:X ⊑ core:X` inheritance
 * classifies the leaves of `X` into a shape group, as the asset metadata
 * meta-model does.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import type { SearchSlots } from '@ontology-search/slots/slots'
import { describe, expect, it } from 'vitest'

import { compileSlotsWithTrace } from '../compiler.js'
import { compileCrossDomainQuery } from '../compiler-cross-domain.js'
import { assetsOf, loadFixture, syntheticRegistry } from './__fixtures__/synthetic-registry.js'

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

const registry = syntheticRegistry([{ name: 'fleet', namespace: FLEET, assetClass: 'Vehicle' }], {
  core: CORE,
})

async function setup(shapes: string, data: string) {
  const { store, vocabIndex } = await loadFixture(PREFIXES + shapes, PREFIXES + data, registry)
  const sparqlOf = async (filters: Record<string, string>) => {
    const slots: SearchSlots = { domains: ['fleet'], filters, ranges: {} }
    return (await compileSlotsWithTrace(slots, { registry, vocabIndex })).sparql
  }
  const assets = async (filters: Record<string, string>) => assetsOf(store, await sparqlOf(filters))
  // A query that names no domain searches every asset domain; the fixture's
  // are passed in, as `compileSlotsWithTrace` reads the loaded ontology's.
  const assetsOfAnyDomain = (filters: Record<string, string>) =>
    assetsOf(
      store,
      compileCrossDomainQuery(
        { domains: [], filters, ranges: {} },
        registry,
        new Set(['fleet']),
        vocabIndex
      )
    )
  return { assets, assetsOfAnyDomain, sparqlOf }
}

/** The vehicle's spec and its value classes; `extra` is appended to the spec shape. */
const codedSchema = (classes: string, specProperties: string) => `
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
  sh:property [ sh:path fleet:road ; sh:node fleet:RoadTypeShape ] ${specProperties}.
fleet:ManoeuvreShape a sh:NodeShape ;
  sh:targetClass fleet:Manoeuvre ;
  sh:property [ sh:path fleet:kind ; sh:node fleet:ManoeuvreTypeShape ] .
fleet:ManoeuvreTypeShape a sh:NodeShape ;
  sh:targetClass fleet:ManoeuvreType ;
  sh:property [ sh:path fleet:code ; sh:in ( "cut_in" "follow" ) ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] .
${classes}
`

// Both coded classes declare `code`, each with its own `sh:in`, and an open
// `reason`. A bare `code` narrows by value to the classes that can hold it; a
// bare `reason` stays on all of them.
const SHARED_LEAVES_SCHEMA = codedSchema(
  `
fleet:RoadTypeShape a sh:NodeShape ;
  sh:targetClass fleet:RoadType ;
  sh:property [ sh:path fleet:code ; sh:in ( "motorway" "rural" ) ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] .
`,
  ''
)

// Only vehicle 2 has one coded value that cuts in for overtaking, and only
// vehicle 1 a motorway chosen for overtaking; the others carry each value on
// a different node.
const SHARED_LEAVES_DATA = `
<urn:vehicle:1> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:others [ a fleet:Manoeuvre ; fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ] ] ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:reason "overtake" ] ] .
<urn:vehicle:2> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:others [ a fleet:Manoeuvre ;
    fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ; fleet:reason "overtake" ] ] ] .
<urn:vehicle:3> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:ego [ a fleet:Manoeuvre ;
    fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ; fleet:reason "merge" ] ] ;
  fleet:road [ a fleet:RoadType ; fleet:code "rural" ; fleet:reason "overtake" ] ] .
<urn:vehicle:4> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:others [ a fleet:Manoeuvre ;
    fleet:kind [ a fleet:ManoeuvreType ; fleet:code "follow" ; fleet:reason "overtake" ] ] ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:reason "merge" ] ] .
`

describe('bare names whose chains can end on a common node', () => {
  it('holds them on one node of the nodes they share', async () => {
    const { assets } = await setup(SHARED_LEAVES_SCHEMA, SHARED_LEAVES_DATA)
    expect(await assets({ code: 'cut_in', reason: 'overtake' })).toEqual(['urn:vehicle:2'])
  }, 30_000)

  it('holds them on the one node a value narrows a name to', async () => {
    // `motorway` narrows `code` to the road: `reason` must hold there too.
    const { assets } = await setup(SHARED_LEAVES_SCHEMA, SHARED_LEAVES_DATA)
    expect(await assets({ code: 'motorway', reason: 'overtake' })).toEqual(['urn:vehicle:1'])
  }, 30_000)

  it('still matches every chain of a bare name on its own', async () => {
    const { assets } = await setup(SHARED_LEAVES_SCHEMA, SHARED_LEAVES_DATA)
    expect(await assets({ reason: 'overtake' })).toEqual([
      'urn:vehicle:1',
      'urn:vehicle:2',
      'urn:vehicle:3',
      'urn:vehicle:4',
    ])
  }, 30_000)

  it('holds them on a shared node in a query that names no domain as well', async () => {
    const { assetsOfAnyDomain } = await setup(SHARED_LEAVES_SCHEMA, SHARED_LEAVES_DATA)
    expect(await assetsOfAnyDomain({ code: 'cut_in', reason: 'overtake' })).toEqual([
      'urn:vehicle:2',
    ])
  }, 30_000)

  it('compiles the same query whatever order the slots name the keys in', async () => {
    // `value`'s chains sort the nested node first, `code`'s the outer one.
    const { sparqlOf } = await setup(
      `
fleet:Vehicle a owl:Class . fleet:Spec a owl:Class . fleet:M a owl:Class . fleet:N a owl:Class .
fleet:VehicleShape a sh:NodeShape ; sh:targetClass fleet:Vehicle ;
  sh:property [ sh:path fleet:hasSpec ; sh:node fleet:SpecShape ] .
fleet:SpecShape a sh:NodeShape ; sh:targetClass fleet:Spec ;
  sh:property [ sh:path fleet:m ; sh:node fleet:MShape ] .
fleet:MShape a sh:NodeShape ; sh:targetClass fleet:M ;
  sh:property [ sh:path fleet:code ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:value ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:sub ; sh:node fleet:NShape ] .
fleet:NShape a sh:NodeShape ; sh:targetClass fleet:N ;
  sh:property [ sh:path fleet:code ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:value ; sh:datatype xsd:string ] .
`,
      ''
    )
    expect(await sparqlOf({ code: 'a', value: 'b' })).toBe(
      await sparqlOf({ value: 'b', code: 'a' })
    )
  }, 30_000)
})

describe('a set of bare names with no node common to all of them', () => {
  // `unit` sits on the road and on an extra class: it shares the road with
  // `reason`, nothing with `code`.
  const schema = codedSchema(
    `
fleet:Extra a owl:Class .
fleet:RoadTypeShape a sh:NodeShape ;
  sh:targetClass fleet:RoadType ;
  sh:property [ sh:path fleet:code ; sh:in ( "motorway" "rural" ) ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:unit ; sh:datatype xsd:string ] .
fleet:ExtraShape a sh:NodeShape ;
  sh:targetClass fleet:Extra ;
  sh:property [ sh:path fleet:unit ; sh:datatype xsd:string ] .
`,
    '; sh:property [ sh:path fleet:extra ; sh:node fleet:ExtraShape ] '
  )
  const data = `
<urn:vehicle:1> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:others [ a fleet:Manoeuvre ;
    fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ; fleet:reason "overtake" ] ] ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:reason "overtake" ; fleet:unit "kmh" ] ] .
<urn:vehicle:2> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:others [ a fleet:Manoeuvre ;
    fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ; fleet:reason "overtake" ] ] ;
  fleet:extra [ a fleet:Extra ; fleet:unit "kmh" ] ] .
<urn:vehicle:3> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:others [ a fleet:Manoeuvre ; fleet:kind [ a fleet:ManoeuvreType ; fleet:code "cut_in" ] ] ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:reason "overtake" ; fleet:unit "kmh" ] ] .
`

  it('only narrows when a further name joins', async () => {
    const { assets } = await setup(schema, data)
    expect(await assets({ code: 'cut_in', reason: 'overtake' })).toEqual([
      'urn:vehicle:1',
      'urn:vehicle:2',
    ])
    expect(await assets({ code: 'cut_in', reason: 'overtake', unit: 'kmh' })).toEqual([
      'urn:vehicle:1',
    ])
  }, 30_000)
})

describe('a bare name narrowed to one chain, next to a unique name on its node', () => {
  // `unit` only the road declares: a unique name. `motorway` narrows `code`
  // to the road, where `unit` sits; `reason` can sit there too.
  const schema = codedSchema(
    `
fleet:RoadTypeShape a sh:NodeShape ;
  sh:targetClass fleet:RoadType ;
  sh:property [ sh:path fleet:code ; sh:in ( "motorway" "rural" ) ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:unit ; sh:datatype xsd:string ] .
`,
    ''
  )
  // Vehicle 1 has the motorway and the km/h on two different roads.
  const data = `
<urn:vehicle:1> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:reason "overtake" ] ,
             [ a fleet:RoadType ; fleet:code "rural" ; fleet:unit "kmh" ] ] .
<urn:vehicle:2> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:reason "overtake" ; fleet:unit "kmh" ] ] .
`

  it('only narrows when a bare name joins it', async () => {
    const { assets, assetsOfAnyDomain } = await setup(schema, data)
    expect(await assets({ code: 'motorway', unit: 'kmh' })).toEqual(['urn:vehicle:2'])
    expect(await assets({ code: 'motorway', unit: 'kmh', reason: 'overtake' })).toEqual([
      'urn:vehicle:2',
    ])
    expect(await assetsOfAnyDomain({ code: 'motorway', unit: 'kmh', reason: 'overtake' })).toEqual([
      'urn:vehicle:2',
    ])
  }, 30_000)
})

describe('bare names held on a shared node, whatever single paths would do', () => {
  it('matches an IRI-valued name textually there', async () => {
    const { assets } = await setup(
      codedSchema(
        `
fleet:LaneType a owl:Class ; rdfs:subClassOf core:Coded .
fleet:RoadTypeShape a sh:NodeShape ;
  sh:targetClass fleet:RoadType ;
  sh:property [ sh:path fleet:code ; sh:in ( "motorway" "rural" ) ] ;
  sh:property [ sh:path fleet:link ; sh:nodeKind sh:IRI ] .
fleet:LaneTypeShape a sh:NodeShape ;
  sh:targetClass fleet:LaneType ;
  sh:property [ sh:path fleet:code ; sh:in ( "bus" "bike" ) ] ;
  sh:property [ sh:path fleet:link ; sh:nodeKind sh:IRI ] .
`,
        '; sh:property [ sh:path fleet:lane ; sh:node fleet:LaneTypeShape ] '
      ),
      `
<urn:vehicle:7> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:link <http://example.org/maps/example-road> ] ] .
`
    )
    expect(await assets({ code: 'motorway', link: 'example' })).toEqual(['urn:vehicle:7'])
  }, 30_000)

  it('keeps them on one node when their names fall into different shape groups', async () => {
    // The first class declaring `reason` is an Annotated one, so `reason` and
    // `code` classify into different groups; on the road they are one node.
    const { assets } = await setup(
      codedSchema(
        `
core:Annotated a owl:Class .
fleet:AAnnotation a owl:Class ; rdfs:subClassOf core:Annotated .
fleet:AAnnotationShape a sh:NodeShape ;
  sh:targetClass fleet:AAnnotation ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] .
fleet:RoadTypeShape a sh:NodeShape ;
  sh:targetClass fleet:RoadType ;
  sh:property [ sh:path fleet:code ; sh:in ( "motorway" "rural" ) ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] .
`,
        ''
      ),
      `
<urn:vehicle:5> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ] , [ a fleet:RoadType ; fleet:reason "overtake" ] ] .
<urn:vehicle:6> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:road [ a fleet:RoadType ; fleet:code "motorway" ; fleet:reason "overtake" ] ] .
`
    )
    expect(await assets({ code: 'motorway', reason: 'overtake' })).toEqual(['urn:vehicle:6'])
  }, 30_000)

  it('finds the node they share behind a predicate several classes declare a leaf on', async () => {
    const { assets } = await setup(
      `
fleet:Vehicle a owl:Class . fleet:Spec a owl:Class .
fleet:A a owl:Class . fleet:B a owl:Class . fleet:C a owl:Class .
fleet:VehicleShape a sh:NodeShape ; sh:targetClass fleet:Vehicle ;
  sh:property [ sh:path fleet:hasSpec ; sh:node fleet:SpecShape ] .
fleet:SpecShape a sh:NodeShape ; sh:targetClass fleet:Spec ;
  sh:property [ sh:path fleet:p ; sh:node fleet:AShape ] ;
  sh:property [ sh:path fleet:p ; sh:node fleet:BShape ] ;
  sh:property [ sh:path fleet:q ; sh:node fleet:CShape ] .
fleet:AShape a sh:NodeShape ; sh:targetClass fleet:A ;
  sh:property [ sh:path fleet:code ; sh:datatype xsd:string ] .
fleet:BShape a sh:NodeShape ; sh:targetClass fleet:B ;
  sh:property [ sh:path fleet:code ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] .
fleet:CShape a sh:NodeShape ; sh:targetClass fleet:C ;
  sh:property [ sh:path fleet:code ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:reason ; sh:datatype xsd:string ] .
`,
      `
<urn:vehicle:8> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:p [ a fleet:B ; fleet:code "x" ; fleet:reason "y" ] ] .
<urn:vehicle:9> a fleet:Vehicle ; fleet:hasSpec [ a fleet:Spec ;
  fleet:p [ a fleet:B ; fleet:code "x" ] ;
  fleet:q [ a fleet:C ; fleet:reason "y" ] ] .
`
    )
    expect(await assets({ code: 'x', reason: 'y' })).toEqual(['urn:vehicle:8'])
  }, 30_000)
})
