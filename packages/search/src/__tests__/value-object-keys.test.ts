/**
 * Value objects end to end (ADR 0009): several categorical properties wrap
 * their value in an object that shares one leaf (`colour → ColourValue →
 * value`, `size → SizeValue → value`), as generated ontologies (LinkML) do.
 * Each chain is its own key with its own `sh:in`; the bare leaf name matches
 * any chain that can hold the value. Compiled against a real Oxigraph store
 * and checked on the rows it returns.
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { syntheticRegistry } from './__fixtures__/synthetic-registry.js'

const NS = 'http://example.org/garage/v1/'

const SHAPES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix garage: <${NS}> .

garage:CarShape a sh:NodeShape ;
  sh:targetClass garage:Car ;
  sh:property [ sh:path garage:colour ; sh:class garage:ColourValue ] ;
  sh:property [ sh:path garage:size ; sh:class garage:SizeValue ] ;
  sh:property [ sh:path garage:note ; sh:class garage:NoteValue ] ;
  sh:property [ sh:path garage:price ; sh:class garage:Money ] ;
  sh:property [ sh:path garage:weight ; sh:class garage:Measure ] .

garage:ColourValueShape a sh:NodeShape ;
  sh:targetClass garage:ColourValue ;
  sh:property [ sh:path garage:value ; sh:in ("red" "blue") ] .
garage:SizeValueShape a sh:NodeShape ;
  sh:targetClass garage:SizeValue ;
  sh:property [ sh:path garage:value ; sh:in ("S" "M" "L") ] .
garage:NoteValueShape a sh:NodeShape ;
  sh:targetClass garage:NoteValue ;
  sh:property [ sh:path garage:value ; sh:datatype xsd:string ] .
garage:MoneyShape a sh:NodeShape ;
  sh:targetClass garage:Money ;
  sh:property [ sh:path garage:amount ; sh:datatype xsd:decimal ] .
garage:MeasureShape a sh:NodeShape ;
  sh:targetClass garage:Measure ;
  sh:property [ sh:path garage:amount ; sh:datatype xsd:decimal ] .
`

const DATA = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix garage: <${NS}> .
<urn:car:1> a garage:Car ; rdfs:label "small red" ;
  garage:colour [ a garage:ColourValue ; garage:value "red" ] ;
  garage:size [ a garage:SizeValue ; garage:value "S" ] .
<urn:car:2> a garage:Car ;
  garage:colour [ a garage:ColourValue ; garage:value "blue" ] ;
  garage:size [ a garage:SizeValue ; garage:value "L" ] ;
  garage:note [ a garage:NoteValue ; garage:value "red" ] .
<urn:car:3> a garage:Car ;
  garage:size [ a garage:SizeValue ; garage:value "M" ] ;
  garage:price [ a garage:Money ; garage:amount 30000 ] ;
  garage:weight [ a garage:Measure ; garage:amount 1200 ] .
`

const garageRegistry = () =>
  syntheticRegistry([{ name: 'garage', namespace: NS, assetClass: 'Car' }])

async function setup() {
  const store = new OxigraphStore()
  await store.loadTurtle(SHAPES, SCHEMA_GRAPH)
  await store.loadTurtle(DATA)
  const registry = garageRegistry()
  const vocabIndex = await buildCompilerVocabFrom(store, registry as any)
  const compile = async (
    filters: Record<string, string | string[]>,
    ranges: Record<string, { min?: number; max?: number }> = {}
  ) =>
    (
      await compileSlotsWithTrace(
        { domains: ['garage'], filters, ranges },
        { registry: registry as any, vocabIndex }
      )
    ).sparql
  const assets = async (sparql: string) =>
    [...new Set((await store.query(sparql)).results.bindings.map((b) => b['asset']?.value))].sort()
  return { vocabIndex, compile, assets }
}

describe('value objects — one key per chain (ADR 0009)', () => {
  it('gives every chain of the shared leaves its own key', async () => {
    const { vocabIndex } = await setup()
    const keys = [...vocabIndex.paths.keys()].filter((k) => k.includes('__')).sort()
    expect(keys).toEqual([
      'garage:colour__value',
      'garage:note__value',
      'garage:price__amount',
      'garage:size__value',
      'garage:weight__amount',
    ])
    expect(vocabIndex.paths.get('garage:size__value')?.allowedValues).toEqual(['L', 'M', 'S'])
    expect(vocabIndex.paths.has('garage:value')).toBe(false)
    expect(vocabIndex.alternatives?.get('garage:value')).toHaveLength(3)
  }, 30_000)

  it('compiles a qualified key to its chain alone', async () => {
    const { compile, assets } = await setup()
    const sparql = await compile({ colour__value: 'red' })
    expect(sparql).toContain('garage:colour')
    expect(sparql).not.toContain('garage:size')
    expect(sparql).not.toContain('UNION')
    expect(await assets(sparql)).toEqual(['urn:car:1'])
    expect(await assets(await compile({ size__value: 'L' }))).toEqual(['urn:car:2'])
  }, 30_000)

  it('routes a bare name by sh:in: a value only one closed chain allows needs no UNION', async () => {
    const { compile, assets } = await setup()
    // "M" is only in SizeValue's sh:in; the open note chain can hold it too.
    const sparql = await compile({ value: 'M' })
    expect(sparql.match(/UNION/g)).toHaveLength(1)
    expect(sparql).toContain('garage:size')
    expect(sparql).toContain('garage:note')
    expect(sparql).not.toContain('garage:colour')
    expect(await assets(sparql)).toEqual(['urn:car:3'])
  }, 30_000)

  it('matches a bare name on any chain that can hold the value', async () => {
    const { compile, assets } = await setup()
    // car 1 has a red colour, car 2 a note "red": both answer `value: red`.
    expect(await assets(await compile({ value: 'red' }))).toEqual(['urn:car:1', 'urn:car:2'])
  }, 30_000)

  it('bounds a bare numeric name on every chain, and a qualified one on its own', async () => {
    const { compile, assets } = await setup()
    expect(await assets(await compile({}, { amount: { min: 20000 } }))).toEqual(['urn:car:3'])
    expect(await assets(await compile({}, { weight__amount: { max: 1500 } }))).toEqual([
      'urn:car:3',
    ])
    expect(await assets(await compile({}, { price__amount: { max: 1500 } }))).toEqual([])
  }, 30_000)

  it('compiles the same slots to the same SPARQL', async () => {
    const first = await setup()
    const second = await setup()
    const slots = { value: 'red', size__value: ['S', 'L'] }
    expect(await first.compile(slots)).toBe(await second.compile(slots))
  }, 30_000)
})
