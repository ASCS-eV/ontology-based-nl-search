/**
 * The shape-group emission builds `asset → spec → group → leaf`: it binds the
 * specification node, hops to the group node with the path's second
 * predicate, and reads the leaf there. A path to a shape-group property that
 * has another length has no such group node — a group class hung straight off
 * the asset (two steps), or one nested below another class (four) — so it
 * must be walked as `sh:path` declares it ([SHACL] §2.3.1.2), or the query
 * asks for a hop the data does not have and matches nothing.
 *
 * Real Oxigraph store, neutral namespaces. `core:` is a second domain so each
 * `fleet:X ⊑ core:X` inheritance classifies the leaves of `X` into a shape
 * group, as the asset metadata meta-model does.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'

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
core:About a owl:Class .
core:Engine a owl:Class .
fleet:Vehicle a owl:Class .
fleet:Spec a owl:Class .
fleet:Drive a owl:Class .
fleet:Content a owl:Class ; rdfs:subClassOf core:Content .
fleet:About a owl:Class ; rdfs:subClassOf core:About .
fleet:Engine a owl:Class ; rdfs:subClassOf core:Engine .

fleet:VehicleShape a sh:NodeShape ;
  sh:targetClass fleet:Vehicle ;
  sh:property [ sh:path fleet:hasSpec ; sh:node fleet:SpecShape ] ;
  sh:property [ sh:path fleet:hasAbout ; sh:node fleet:AboutShape ] .

# asset → spec → Content group → colour: the shape-group meta-model.
fleet:SpecShape a sh:NodeShape ;
  sh:targetClass fleet:Spec ;
  sh:property [ sh:path fleet:hasContent ; sh:node fleet:ContentShape ] ;
  sh:property [ sh:path fleet:hasDrive ; sh:node fleet:DriveShape ] .
fleet:ContentShape a sh:NodeShape ;
  sh:targetClass fleet:Content ;
  sh:property [ sh:path fleet:colour ; sh:in ( "red" "blue" ) ] .

# asset → About group → nickname / seats: two steps, no specification node.
fleet:AboutShape a sh:NodeShape ;
  sh:targetClass fleet:About ;
  sh:property [ sh:path fleet:nickname ; sh:datatype xsd:string ] ;
  sh:property [ sh:path fleet:seats ; sh:datatype xsd:integer ] .

# asset → spec → drive → Engine group → power: four steps.
fleet:DriveShape a sh:NodeShape ;
  sh:targetClass fleet:Drive ;
  sh:property [ sh:path fleet:hasEngine ; sh:node fleet:EngineShape ] .
fleet:EngineShape a sh:NodeShape ;
  sh:targetClass fleet:Engine ;
  sh:property [ sh:path fleet:power ; sh:datatype xsd:decimal ] .
`

const DATA_TTL = `
@prefix fleet: <${FLEET}> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<urn:vehicle:fast> a fleet:Vehicle ; rdfs:label "Fast" ;
  fleet:hasSpec [ a fleet:Spec ;
    fleet:hasContent [ a fleet:Content ; fleet:colour "red" ] ;
    fleet:hasDrive [ a fleet:Drive ; fleet:hasEngine [ a fleet:Engine ; fleet:power 300 ] ] ] ;
  fleet:hasAbout [ a fleet:About ; fleet:nickname "Speedy" ; fleet:seats 2 ] .
<urn:vehicle:slow> a fleet:Vehicle ; rdfs:label "Slow" ;
  fleet:hasSpec [ a fleet:Spec ;
    fleet:hasContent [ a fleet:Content ; fleet:colour "red" ] ;
    fleet:hasDrive [ a fleet:Drive ; fleet:hasEngine [ a fleet:Engine ; fleet:power 50 ] ] ] ;
  fleet:hasAbout [ a fleet:About ; fleet:nickname "Snail" ; fleet:seats 5 ] .
`

/** The minimum DomainRegistry surface the discovery and compiler read. */
function fleetRegistry() {
  const desc = {
    name: 'fleet',
    namespace: FLEET,
    prefix: 'fleet',
    targetClass: 'fleet:Vehicle',
    targetClassIri: `${FLEET}Vehicle`,
    version: 'v1',
    shapes: ['Vehicle'],
    declaredPrefixes: { fleet: FLEET },
  }
  return {
    domains: new Map([['fleet', desc]]),
    domainNames: ['fleet'],
    prefixesFor() {
      return [
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
        `PREFIX fleet: <${FLEET}>`,
      ].join('\n')
    },
    allPrefixes() {
      return this.prefixesFor()
    },
    resolveByIriDomain(iriDomain: string) {
      return iriDomain === 'fleet' ? desc : undefined
    },
    domainForIri(iri: string) {
      if (iri.startsWith(FLEET)) return 'fleet'
      if (iri.startsWith(CORE)) return 'core'
      return undefined
    },
    getAllNamespaces() {
      return new Set([FLEET, CORE])
    },
  }
}

let store: OxigraphStore
// `any`: the synthetic registry stands in for the disk-derived DomainRegistry,
// as in the flat-ontology genericity tests.
let registry: any
let vocabIndex: Awaited<ReturnType<typeof buildCompilerVocabFrom>>

beforeAll(async () => {
  store = new OxigraphStore()
  await store.loadTurtle(SCHEMA_TTL, SCHEMA_GRAPH)
  await store.loadTurtle(DATA_TTL)
  registry = fleetRegistry()
  vocabIndex = await buildCompilerVocabFrom(store, registry)
}, 30_000)

async function assetsFor(
  filters: Record<string, string>,
  ranges: Record<string, { min?: number; max?: number }> = {}
): Promise<string[]> {
  const { sparql } = await compileSlotsWithTrace(
    { domains: ['fleet'], filters, ranges },
    { registry, vocabIndex }
  )
  const result = await store.query(sparql)
  return [...new Set(result.results.bindings.map((row) => row['asset']?.value))].sort() as string[]
}

describe('a shape-group property whose path is not asset → spec → group → leaf', () => {
  it('has group properties at two, three and four steps (fixture sanity)', () => {
    for (const name of ['colour', 'nickname', 'seats', 'power']) {
      expect(vocabIndex.shapeGroups.has(`${name}:fleet`), name).toBe(true)
    }
    expect(vocabIndex.paths.get('fleet:nickname')?.steps).toHaveLength(2)
    expect(vocabIndex.paths.get('fleet:colour')?.steps).toHaveLength(3)
    expect(vocabIndex.paths.get('fleet:power')?.steps).toHaveLength(4)
  })

  it('filters a two-step leaf where the path puts it', async () => {
    expect(await assetsFor({ nickname: 'Speedy' })).toEqual(['urn:vehicle:fast'])
  }, 30_000)

  it('ranges over a two-step leaf where the path puts it', async () => {
    expect(await assetsFor({}, { seats: { min: 4 } })).toEqual(['urn:vehicle:slow'])
  }, 30_000)

  it('ranges over a four-step leaf where the path puts it', async () => {
    expect(await assetsFor({}, { power: { min: 100 } })).toEqual(['urn:vehicle:fast'])
  }, 30_000)

  it('combines them with a group property the meta-model shape still serves', async () => {
    expect(await assetsFor({ colour: 'red', nickname: 'Snail' }, { power: { max: 100 } })).toEqual([
      'urn:vehicle:slow',
    ])
  }, 30_000)
})
