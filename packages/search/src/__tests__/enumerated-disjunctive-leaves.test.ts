/**
 * A property shape that enumerates its values through `sh:or` rather than a
 * top-level `sh:in` ([SHACL] §4.6.3, §4.8.3): every member an `sh:in` list,
 * or a list beside a member that admits other values. Generated shapes write
 * an enumeration this way when its values come from several enumerations.
 * Discovered and compiled against a real Oxigraph store, in a neutral
 * namespace so no real ontology name enters the test.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { queryDisjunctiveEnumerations } from '../disjunctive-enumerations.js'
import { buildPropertyPaths } from '../property-paths.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'

const NS = 'http://example.org/depot/v1/'

const SCHEMA_TTL = `
@prefix depot: <${NS}> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

depot:VehicleShape a sh:NodeShape ;
  sh:targetClass depot:Vehicle ;
  # Closed: every member is a list, so the union is the vocabulary.
  sh:property [
    sh:path depot:kind ;
    sh:name "vehicle kind" ;
    sh:or ( [ sh:in ( "car" "van" ) ] [ sh:in ( "bus" ) ] )
  ] ;
  # Open: a listed value or any IRI.
  sh:property [
    sh:path depot:licence ;
    sh:or ( [ sh:in ( "MIT" "Apache-2.0" ) ] [ sh:nodeKind sh:IRI ] )
  ] .
`

const DATA_TTL = `
@prefix depot: <${NS}> .
<urn:vehicle:car> a depot:Vehicle ; depot:kind "car" ; depot:licence "MIT" .
<urn:vehicle:bus> a depot:Vehicle ; depot:kind "bus" ; depot:licence <urn:licence:custom> .
`

/** The minimum DomainRegistry surface the discovery and compiler read. */
function depotRegistry() {
  const desc = {
    name: 'depot',
    namespace: NS,
    prefix: 'depot',
    targetClass: 'depot:Vehicle',
    targetClassIri: `${NS}Vehicle`,
    version: 'v1',
    shapes: ['Vehicle'],
    declaredPrefixes: { depot: NS },
  }
  const prefixes = [
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
    'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
    `PREFIX depot: <${NS}>`,
  ].join('\n')
  return {
    domains: new Map([['depot', desc]]),
    domainNames: ['depot'],
    prefixesFor: () => prefixes,
    allPrefixes: () => prefixes,
    resolveByIriDomain: (name: string) => (name === 'depot' ? desc : undefined),
    domainForIri: (iri: string) => (iri.startsWith(NS) ? 'depot' : undefined),
    getAllNamespaces: () => new Set([NS]),
  }
}

let store: OxigraphStore
// `as any`: the synthetic registry stands in for the disk-derived one.
const registry = depotRegistry() as any

beforeAll(async () => {
  store = new OxigraphStore()
  await store.loadTurtle(SCHEMA_TTL, SCHEMA_GRAPH)
  await store.loadTurtle(DATA_TTL)
}, 30_000)

const assetsFor = async (filters: Record<string, string>): Promise<string[]> => {
  const vocabIndex = await buildCompilerVocabFrom(store, registry)
  const { sparql } = await compileSlotsWithTrace(
    { domains: ['depot'], filters, ranges: {} },
    { registry, vocabIndex }
  )
  const rows = (await store.query(sparql)).results.bindings
  return [...new Set(rows.map((row) => row['asset']?.value ?? ''))].sort()
}

describe('enumerations written as an sh:or', () => {
  /**
   * Regression: a property shape whose `sh:or` members carried only `sh:in`
   * was neither a leaf nor enumerated, so its property could not be searched
   * at all.
   */
  it('discovers both properties as leaves', async () => {
    const paths = await buildPropertyPaths(store, registry)
    const names = paths.map((path) => path.propertyName).sort()
    expect(names).toEqual(['kind', 'licence'])
  }, 30_000)

  it('gives the closed union its values, and the open one none', async () => {
    const paths = await buildPropertyPaths(store, registry)
    const byName = new Map(paths.map((path) => [path.propertyName, path]))
    expect(byName.get('kind')?.allowedValues).toEqual(['bus', 'car', 'van'])
    expect(byName.get('licence')?.allowedValues).toBeUndefined()

    const enumerations = await queryDisjunctiveEnumerations(store)
    expect(enumerations).toEqual([
      {
        propertyIri: `${NS}kind`,
        owningClasses: [`${NS}Vehicle`],
        values: ['bus', 'car', 'van'],
        name: 'vehicle kind',
      },
    ])
  }, 30_000)

  it('filters on either property', async () => {
    expect(await assetsFor({ kind: 'bus' })).toEqual(['urn:vehicle:bus'])
    expect(await assetsFor({ licence: 'MIT' })).toEqual(['urn:vehicle:car'])
  }, 30_000)
})
