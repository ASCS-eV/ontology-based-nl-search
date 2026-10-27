/**
 * A property shape that enumerates its values through `sh:or` rather than a
 * top-level `sh:in` ([SHACL] §4.6.3, §4.8.3): every member an `sh:in` list,
 * or a list beside a member that admits other values. Generated shapes write
 * an enumeration this way when its values come from several enumerations.
 * Discovered and compiled against a real Oxigraph store, in a neutral
 * namespace so no real ontology name enters the test.
 *
 * The slot vocabulary (`extractSchemaVocabulary`) reads the compiler's
 * cached vocabulary; here it is built from the same synthetic store.
 */
import type { SparqlStore } from '@ontology-search/sparql/types'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { queryDisjunctiveEnumerations } from '../disjunctive-enumerations.js'
import { buildPropertyPaths } from '../property-paths.js'
import { queryLeafEnumerations } from '../property-paths-queries.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { extractSchemaVocabulary, resetVocabulary } from '../vocabulary-extractor.js'
import { syntheticRegistry } from './__fixtures__/synthetic-registry.js'

vi.mock('../compiler.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../compiler.js')>()
  return { ...actual, getCompilerVocab: () => actual.buildCompilerVocabFrom(store, registry) }
})

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
    sh:description "What the vehicle is." ;
    sh:or ( [ sh:in ( "car" "van" ) ] [ sh:in ( "bus" ) ] )
  ] ;
  # Open: a listed value or any IRI.
  sh:property [
    sh:path depot:licence ;
    sh:or ( [ sh:in ( "MIT" "Apache-2.0" ) ] [ sh:nodeKind sh:IRI ] )
  ] ;
  # Both lists apply: only a value on each is accepted.
  sh:property [
    sh:path depot:colour ;
    sh:in ( "red" "blue" ) ;
    sh:or ( [ sh:in ( "blue" "green" ) ] )
  ] .

# A node shape without a name declares a closed union too.
[] a sh:NodeShape ;
  sh:targetClass depot:Vehicle ;
  sh:property [
    sh:path depot:shift ;
    sh:or ( [ sh:in ( "day" ) ] [ sh:in ( "night" ) ] )
  ] .
`

const DATA_TTL = `
@prefix depot: <${NS}> .
<urn:vehicle:car> a depot:Vehicle ; depot:kind "car" ; depot:licence "MIT" ;
  depot:colour "blue" ; depot:shift "day" .
<urn:vehicle:bus> a depot:Vehicle ; depot:kind "bus" ; depot:licence <urn:licence:custom> ;
  depot:colour "red" ; depot:shift "night" .
`

const depotRegistry = () =>
  syntheticRegistry([{ name: 'depot', namespace: NS, assetClass: 'Vehicle' }])

let store: OxigraphStore
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
  it('discovers every property as a leaf', async () => {
    const paths = await buildPropertyPaths(store, registry)
    const names = paths.map((path) => path.propertyName).sort()
    expect(names).toEqual(['colour', 'kind', 'licence', 'shift'])
  }, 30_000)

  it('lists the values a closed union accepts, and none for an open one', async () => {
    const paths = await buildPropertyPaths(store, registry)
    const byName = new Map(paths.map((path) => [path.propertyName, path]))
    expect(byName.get('kind')?.allowedValues).toEqual(['bus', 'car', 'van'])
    expect(byName.get('licence')?.allowedValues).toBeUndefined()
    // The blank node shape's union counts like a named shape's.
    expect(byName.get('shift')?.allowedValues).toEqual(['day', 'night'])
    // Both lists apply, so only the value on each is accepted.
    expect(byName.get('colour')?.allowedValues).toEqual(['blue'])

    const enumerations = await queryDisjunctiveEnumerations(store)
    expect(enumerations).toEqual([
      { propertyIri: `${NS}colour`, owningClasses: [`${NS}Vehicle`], values: ['blue'] },
      {
        propertyIri: `${NS}kind`,
        owningClasses: [`${NS}Vehicle`],
        values: ['bus', 'car', 'van'],
        name: 'vehicle kind',
        description: 'What the vehicle is.',
      },
      { propertyIri: `${NS}shift`, owningClasses: [`${NS}Vehicle`], values: ['day', 'night'] },
    ])
  }, 30_000)

  it('gives the slot vocabulary the union with its label and description', async () => {
    resetVocabulary()
    const { enumProperties } = await extractSchemaVocabulary(store)
    const byKey = new Map(enumProperties.map((property) => [property.localName, property]))
    expect(byKey.get('kind')).toMatchObject({
      label: 'vehicle kind',
      description: 'What the vehicle is.',
      allowedValues: ['bus', 'car', 'van'],
    })
    expect(byKey.get('colour')?.allowedValues).toEqual(['blue'])
    expect(byKey.get('shift')?.allowedValues).toEqual(['day', 'night'])
    expect(byKey.has('licence')).toBe(false)
  }, 30_000)

  it('filters on each property', async () => {
    expect(await assetsFor({ kind: 'bus' })).toEqual(['urn:vehicle:bus'])
    expect(await assetsFor({ licence: 'MIT' })).toEqual(['urn:vehicle:car'])
    expect(await assetsFor({ colour: 'blue' })).toEqual(['urn:vehicle:car'])
    expect(await assetsFor({ shift: 'night' })).toEqual(['urn:vehicle:bus'])
  }, 30_000)
})

/**
 * The union query and the plain `sh:in` query run together. A store that
 * fails the union query while the other is still running must fail the
 * caller, not the process: a rejection nobody awaits yet ends a Node process.
 */
describe('a failing union query', () => {
  const EMPTY = { head: { vars: [] }, results: { bindings: [] } }
  const unionFailsFirst = (): SparqlStore =>
    ({
      query: (sparql: string) =>
        sparql.includes('SELECT ?propShape')
          ? new Promise((_, reject) => setTimeout(() => reject(new Error('union query failed')), 1))
          : new Promise((resolve) => setTimeout(() => resolve(EMPTY), 20)),
    }) as unknown as SparqlStore

  const settled = () => new Promise((resolve) => setTimeout(resolve, 40))

  for (const [name, read] of [
    ['the leaf enumerations', (s: SparqlStore) => queryLeafEnumerations(s)],
    ['the slot vocabulary', (s: SparqlStore) => (resetVocabulary(), extractSchemaVocabulary(s))],
  ] as const) {
    it(`fails ${name} as a whole, leaving no rejection unhandled`, async () => {
      const unhandled: unknown[] = []
      const record = (reason: unknown) => unhandled.push(reason)
      process.on('unhandledRejection', record)
      try {
        await expect(read(unionFailsFirst())).rejects.toThrow('union query failed')
        await settled()
        expect(unhandled).toEqual([])
      } finally {
        process.off('unhandledRejection', record)
      }
    })
  }
})
