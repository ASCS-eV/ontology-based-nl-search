/**
 * What a vocabulary in `slots.domains` searches, on a synthetic ontology small
 * enough to state every expected row (`compiler-vocabulary-scope.ts`).
 *
 * Two asset domains (`garage`, `depot`, both below `base:Asset`) embed tags of
 * the `tags` vocabulary; `tags-v2` lives in a namespace nested inside the
 * `tags` one. Some assets carry tags, some do not, one carries only a
 * `tags-v2` property. Tag sheets are published on their own: one that another
 * document merely points at, and one a car composes through its tag
 * predicate. Compiled against a real Oxigraph store and checked on the rows
 * it returns.
 */
import type { SearchSlots } from '@ontology-search/slots/slots'
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { syntheticRegistry } from './__fixtures__/synthetic-registry.js'

const BASE = 'http://example.org/base/'
const GARAGE = 'http://example.org/garage/'
const DEPOT = 'http://example.org/depot/'
const TAGS = 'http://example.org/tags/'
const TAGS_V2 = 'http://example.org/tags/v2/'

const SHAPES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix base: <${BASE}> .
@prefix garage: <${GARAGE}> .
@prefix depot: <${DEPOT}> .
@prefix tags: <${TAGS}> .
@prefix tagsv2: <${TAGS_V2}> .

garage:Car rdfs:subClassOf base:Asset .
depot:Depot rdfs:subClassOf base:Asset .

garage:CarShape a sh:NodeShape ;
  sh:targetClass garage:Car ;
  sh:property [ sh:path garage:hasBadge ; sh:class garage:Badge ] ;
  sh:property [ sh:path garage:hasTag ; sh:class tags:Tag ] ;
  sh:property [ sh:path garage:hasFinish ; sh:class tags:Finish ] .
garage:BadgeShape a sh:NodeShape ;
  sh:targetClass garage:Badge ;
  sh:property [ sh:path garage:make ; sh:in ("A" "B") ] .

depot:DepotShape a sh:NodeShape ;
  sh:targetClass depot:Depot ;
  sh:property [ sh:path depot:hasAddress ; sh:class depot:Address ] ;
  sh:property [ sh:path depot:hasTag ; sh:class tags:Tag ] .
depot:AddressShape a sh:NodeShape ;
  sh:targetClass depot:Address ;
  sh:property [ sh:path depot:city ; sh:in ("X" "Y") ] .

tags:SheetShape a sh:NodeShape ;
  sh:targetClass tags:Sheet ;
  sh:property [ sh:path tags:entry ; sh:class tags:Tag ] .
tags:TagShape a sh:NodeShape ;
  sh:targetClass tags:Tag ;
  sh:property [ sh:path tags:colour ; sh:in ("red" "blue") ] ;
  sh:property [ sh:path tagsv2:grade ; sh:in ("gold") ] .
tags:FinishShape a sh:NodeShape ;
  sh:targetClass tags:Finish ;
  sh:property [ sh:path tags:shine ; sh:in ("matte" "gloss") ] .
`

const DATA = `
@prefix garage: <${GARAGE}> .
@prefix depot: <${DEPOT}> .
@prefix tags: <${TAGS}> .
@prefix tagsv2: <${TAGS_V2}> .

<urn:car:tagged> a garage:Car ;
  garage:hasBadge [ a garage:Badge ; garage:make "A" ] ;
  garage:hasTag [ a tags:Tag ; tags:colour "red" ] .
<urn:car:untagged> a garage:Car ;
  garage:hasBadge [ a garage:Badge ; garage:make "A" ] .
<urn:car:v2-only> a garage:Car ;
  garage:hasBadge [ a garage:Badge ; garage:make "B" ] ;
  garage:hasTag [ a tags:Tag ; tagsv2:grade "gold" ] .
<urn:car:finished> a garage:Car ;
  garage:hasBadge [ a garage:Badge ; garage:make "B" ] ;
  garage:hasTag [ a tags:Tag ; tags:colour "blue" ] ;
  garage:hasFinish [ a tags:Finish ; tags:shine "gloss" ] .
<urn:car:polished> a garage:Car ;
  garage:hasBadge [ a garage:Badge ; garage:make "B" ] ;
  garage:hasFinish [ a tags:Finish ; tags:shine "matte" ] .
<urn:depot:tagged> a depot:Depot ;
  depot:hasAddress [ a depot:Address ; depot:city "X" ] ;
  depot:hasTag [ a tags:Tag ; tags:colour "blue" ] .
<urn:depot:untagged> a depot:Depot ;
  depot:hasAddress [ a depot:Address ; depot:city "X" ] .
<urn:sheet:standalone> a tags:Sheet ;
  tags:entry [ a tags:Tag ; tags:colour "red" ] .
<urn:note:1> tags:mentions <urn:sheet:standalone> .
<urn:sheet:composed> a tags:Sheet ;
  tags:entry [ a tags:Tag ; tags:colour "red" ] .
<urn:car:tagged> garage:hasTag <urn:sheet:composed> .
`

const DOMAINS: [string, string, string][] = [
  ['base', BASE, 'Asset'],
  ['garage', GARAGE, 'Car'],
  ['depot', DEPOT, 'Depot'],
  ['tags', TAGS, 'Tag'],
  ['tags-v2', TAGS_V2, 'Grade'],
]

const fixtureRegistry = () =>
  syntheticRegistry(
    DOMAINS.map(([name, namespace, assetClass]) => ({ name, namespace, assetClass }))
  )

async function setup() {
  const store = new OxigraphStore()
  await store.loadTurtle(SHAPES, SCHEMA_GRAPH)
  await store.loadTurtle(DATA)
  const registry = fixtureRegistry()
  const vocabIndex = await buildCompilerVocabFrom(store, registry as any)
  const compile = (slots: SearchSlots) =>
    compileSlotsWithTrace(slots, { registry: registry as any, vocabIndex })
  const search = async (
    domains: string[],
    filters: Record<string, string | string[]> = {}
  ): Promise<string[]> => {
    const { sparql } = await compile({ domains, filters, ranges: {} })
    const rows = (await store.query(sparql)).results.bindings
    return [...new Set(rows.map((row) => row['asset']?.value ?? ''))].sort()
  }
  return { search, compile }
}

describe('a vocabulary in the scope', () => {
  /**
   * Regression: the domains using a vocabulary were searched without any
   * restriction, so "tags only" returned every car and every depot, tagged
   * or not.
   */
  it('returns the assets carrying its content and its standalone documents', async () => {
    const { search } = await setup()
    expect(await search(['tags'])).toEqual([
      'urn:car:finished',
      'urn:car:polished',
      'urn:car:tagged',
      'urn:depot:tagged',
      'urn:sheet:standalone',
    ])
  }, 60_000)

  /**
   * Regression: a standalone document that any triple pointed at was taken
   * as nested in an asset.
   */
  it('keeps a document standalone whatever merely points at it', async () => {
    const { search, compile } = await setup()
    const found = await search(['tags'], { colour: 'red' })
    // Pointed at by a note, not composed: standalone.
    expect(found).toContain('urn:sheet:standalone')
    // Composed into a car through its tag predicate: the car answers.
    expect(found).not.toContain('urn:sheet:composed')
    const { sparql } = await compile({ domains: ['tags'], filters: {}, ranges: {} })
    expect(sparql).toContain('VALUES ?_ownerLink')
  }, 60_000)

  it('finds content through every chain the domain has into the vocabulary', async () => {
    const { search } = await setup()
    // Only `hasFinish` reaches the polished car's content.
    expect(await search(['tags'], { shine: 'matte' })).toEqual(['urn:car:polished'])
  }, 60_000)

  it('compiles the same query whatever the order of the vocabularies', async () => {
    const { compile } = await setup()
    const one = await compile({ domains: ['tags', 'tags-v2'], filters: {}, ranges: {} })
    const other = await compile({ domains: ['tags-v2', 'tags'], filters: {}, ranges: {} })
    expect(other.sparql).toBe(one.sparql)
  }, 60_000)

  /**
   * Regression: the peer arms of several named domains take no reference,
   * and the reference went unreported, so the answer silently covered more
   * than the request.
   */
  it('reports a reference the peer arms cannot apply', async () => {
    const { compile } = await setup()
    const { droppedReferences } = await compile({
      domains: ['garage', 'depot'],
      filters: {},
      ranges: {},
      references: [{ domain: 'tags', filters: { colour: 'red' } }],
    })
    expect(droppedReferences).toEqual(['tags'])
  }, 60_000)

  it('does not count a property of a vocabulary nested in its namespace', async () => {
    const { search } = await setup()
    expect(await search(['tags'])).not.toContain('urn:car:v2-only')
    expect(await search(['tags-v2'])).toEqual(['urn:car:v2-only'])
  }, 60_000)

  it('keeps the restriction under a constraint outside the vocabulary', async () => {
    const { search } = await setup()
    expect(await search(['tags'], { make: 'A' })).toEqual(['urn:car:tagged'])
  }, 60_000)

  it('applies its own constraints to every arm', async () => {
    const { search } = await setup()
    expect(await search(['tags'], { colour: 'red' })).toEqual([
      'urn:car:tagged',
      'urn:sheet:standalone',
    ])
  }, 60_000)

  it('drops an owner that cannot express a constraint of the vocabulary', async () => {
    const { search } = await setup()
    // Only cars reach `shine`. A depot reaches `colour`, so a depot arm would
    // apply that and ignore `shine`, returning the blue-tagged depot.
    expect(await search(['tags'], { shine: 'gloss', colour: 'blue' })).toEqual(['urn:car:finished'])
  }, 60_000)

  /**
   * Regression: a vocabulary whose class the asset classes are subclasses of
   * describes every asset by type, but with no property of its own on them a
   * content restriction found none, so selecting it returned nothing.
   */
  it('answers a vocabulary that types the asset classes with every asset of them', async () => {
    const { search } = await setup()
    expect(await search(['base'])).toEqual([
      'urn:car:finished',
      'urn:car:polished',
      'urn:car:tagged',
      'urn:car:untagged',
      'urn:car:v2-only',
      'urn:depot:tagged',
      'urn:depot:untagged',
    ])
  }, 60_000)

  it('searches an owner the scope names as named, without the restriction', async () => {
    const { search } = await setup()
    expect(await search(['garage', 'tags'])).toEqual([
      'urn:car:finished',
      'urn:car:polished',
      'urn:car:tagged',
      'urn:car:untagged',
      'urn:car:v2-only',
      'urn:depot:tagged',
      'urn:sheet:standalone',
    ])
  }, 60_000)
})
