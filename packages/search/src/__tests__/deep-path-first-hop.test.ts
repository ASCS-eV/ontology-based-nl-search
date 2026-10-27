/**
 * The compiler hangs a deep filter path (more than the shape-group standard
 * of three steps) off the domain's specification variable, which is bound
 * through the asset → specification hop. A deep path that starts with a
 * different hop — a leaf under another branch of the asset, such as one
 * inherited from a superclass shape — must be walked from the asset with its
 * own first hop, or the query asks for it under the wrong node and matches
 * nothing.
 *
 * Real Oxigraph store, neutral namespaces. `core:` is a second domain so the
 * `fleet:Content ⊑ core:Content` inheritance classifies `colour` into a
 * shape group, as the asset metadata meta-model does.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { syntheticRegistry } from './__fixtures__/synthetic-registry.js'

const FLEET = 'http://example.org/fleet/v1/'
const CORE = 'http://example.org/core/v1/'

const SCHEMA_TTL = `
@prefix fleet: <${FLEET}> .
@prefix core: <${CORE}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

core:Content a owl:Class .
fleet:Vehicle a owl:Class .
fleet:Spec a owl:Class .
fleet:Content a owl:Class ; rdfs:subClassOf core:Content .
fleet:Description a owl:Class .
fleet:TagHolder a owl:Class .
fleet:Label a owl:Class .

fleet:VehicleShape a sh:NodeShape ;
  sh:targetClass fleet:Vehicle ;
  sh:property [ sh:path fleet:hasSpec ; sh:node fleet:SpecShape ] ;
  sh:property [ sh:path fleet:hasDescription ; sh:node fleet:DescriptionShape ] .

# asset → spec → Content group → colour: the shape-group meta-model.
fleet:SpecShape a sh:NodeShape ;
  sh:targetClass fleet:Spec ;
  sh:property [ sh:path fleet:hasContent ; sh:node fleet:ContentShape ] .
fleet:ContentShape a sh:NodeShape ;
  sh:targetClass fleet:Content ;
  sh:property [ sh:path fleet:colour ; sh:in ( "red" "blue" ) ] .

# asset → description → tag holder → label → labelText: four steps, and the
# first is not the specification hop.
fleet:DescriptionShape a sh:NodeShape ;
  sh:targetClass fleet:Description ;
  sh:property [ sh:path fleet:hasTag ; sh:node fleet:TagHolderShape ] .
fleet:TagHolderShape a sh:NodeShape ;
  sh:targetClass fleet:TagHolder ;
  sh:property [ sh:path fleet:hasLabel ; sh:node fleet:LabelShape ] .
fleet:LabelShape a sh:NodeShape ;
  sh:targetClass fleet:Label ;
  sh:property [ sh:path fleet:labelText ; sh:datatype xsd:string ] .
`

const DATA_TTL = `
@prefix fleet: <${FLEET}> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<urn:vehicle:fast> a fleet:Vehicle ; rdfs:label "Fast" ;
  fleet:hasSpec [ a fleet:Spec ; fleet:hasContent [ a fleet:Content ; fleet:colour "red" ] ] ;
  fleet:hasDescription [ a fleet:Description ;
    fleet:hasTag [ a fleet:TagHolder ; fleet:hasLabel [ a fleet:Label ; fleet:labelText "fast" ] ] ] .
<urn:vehicle:slow> a fleet:Vehicle ; rdfs:label "Slow" ;
  fleet:hasSpec [ a fleet:Spec ; fleet:hasContent [ a fleet:Content ; fleet:colour "red" ] ] ;
  fleet:hasDescription [ a fleet:Description ;
    fleet:hasTag [ a fleet:TagHolder ; fleet:hasLabel [ a fleet:Label ; fleet:labelText "slow" ] ] ] .
`

const fleetRegistry = () =>
  syntheticRegistry([{ name: 'fleet', namespace: FLEET, assetClass: 'Vehicle' }], { core: CORE })

let store: OxigraphStore
let registry: any
let vocabIndex: Awaited<ReturnType<typeof buildCompilerVocabFrom>>

beforeAll(async () => {
  store = new OxigraphStore()
  await store.loadTurtle(SCHEMA_TTL, SCHEMA_GRAPH)
  await store.loadTurtle(DATA_TTL)
  registry = fleetRegistry()
  vocabIndex = await buildCompilerVocabFrom(store, registry)
}, 30_000)

describe('a deep filter path whose first hop is not the specification hop', () => {
  it('is a deep path, next to a shape-group property (fixture sanity)', () => {
    expect(vocabIndex.shapeGroupPropertyNames.has('colour')).toBe(true)
    expect(vocabIndex.paths.get('fleet:labelText')?.steps).toHaveLength(4)
  })

  it('is walked from the asset with its own first hop, and matches', async () => {
    const { sparql } = await compileSlotsWithTrace(
      { domains: ['fleet'], filters: { colour: 'red', labelText: 'fast' }, ranges: {} },
      { registry, vocabIndex }
    )

    expect(sparql).toMatch(/\?asset\s+fleet:hasDescription\s/)
    const result = await store.query(sparql)
    const assets = new Set(result.results.bindings.map((row) => row['asset']?.value))
    expect([...assets]).toEqual(['urn:vehicle:fast'])
  }, 30_000)
})
