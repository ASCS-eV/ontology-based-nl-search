import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it } from 'vitest'

import { emitDirectPathFilters, pathPrefixKey } from '../compiler-helpers-paths.js'
import type { CompilerVocab } from '../compiler-vocab.js'
import type { PropertyPath } from '../property-paths.js'

const NS = 'http://example.org/'
const XSD = 'http://www.w3.org/2001/XMLSchema#'
const path = (name: string, intermediate: string): PropertyPath =>
  ({
    domain: 'x',
    propertyName: name,
    propertyIri: `${NS}${name}`,
    assetClass: `${NS}Asset`,
    leafKind: 'literal',
    steps: [
      { predicate: `${NS}hasSpec`, intermediate: `${NS}Spec` },
      { predicate: `${NS}hasContent`, intermediate: `${NS}${intermediate}` },
      { predicate: `${NS}${name}` },
    ],
  }) as PropertyPath

function compile(entries: [string, string, PropertyPath][]): string[] {
  const patterns: string[] = []
  emitDirectPathFilters(
    'x',
    entries,
    [],
    '?asset',
    '',
    patterns,
    [],
    new Set(),
    new Set(),
    { domains: new Map() } as unknown as DomainRegistry,
    { range2DProperties: new Map() } as unknown as CompilerVocab
  )
  return patterns
}

/**
 * Regression: leaves owned by different `sh:or` alternatives behind one
 * multi-valued predicate ([SHACL] §4.6.3) live on DIFFERENT value nodes.
 * Sharing one intermediate variable demanded a single node of both shapes
 * and returned zero rows.
 */
describe('emitDirectPathFilters — intermediate sharing', () => {
  it('binds leaves of different reached classes to separate nodes', () => {
    const patterns = compile([
      ['behaviourFlag', 'true', path('behaviourFlag', 'Behaviour')],
      ['roadUserFlag', 'true', path('roadUserFlag', 'RoadUser')],
    ])
    const contentVars = new Set(
      patterns.filter((p) => p.includes('hasContent')).map((p) => p.split(' ')[2])
    )
    expect(contentVars.size).toBe(2)
  })

  it('still shares the node for leaves of the same class', () => {
    const patterns = compile([
      ['a', 'true', path('a', 'Odd')],
      ['b', 'true', path('b', 'Odd')],
    ])
    expect(patterns.filter((p) => p.includes('hasContent'))).toHaveLength(1)
  })

  it('keys on predicate and reached class', () => {
    expect(pathPrefixKey(path('a', 'Odd'))).not.toBe(pathPrefixKey(path('a', 'Behaviour')))
    expect(pathPrefixKey(path('a', 'Odd'))).toBe(pathPrefixKey(path('b', 'Odd')))
  })
})

describe('emitDirectPathFilters — datatype-driven comparison', () => {
  it('compares a leaf declared xsd:boolean by lexical form', () => {
    const filters: string[] = []
    emitDirectPathFilters(
      'x',
      [['flag', 'true', { ...path('flag', 'Odd'), datatype: `${XSD}boolean` }]],
      [],
      '?asset',
      '',
      [],
      filters,
      new Set(),
      new Set(),
      { domains: new Map() } as unknown as DomainRegistry,
      { range2DProperties: new Map() } as unknown as CompilerVocab
    )
    expect(filters).toEqual(['FILTER(STR(?flag) IN ("true", "1"))'])
  })

  it('keeps plain equality when the leaf is a string, whatever the value looks like', () => {
    const filters: string[] = []
    emitDirectPathFilters(
      'x',
      [['label', 'True', { ...path('label', 'Odd'), datatype: `${XSD}string` }]],
      [],
      '?asset',
      '',
      [],
      filters,
      new Set(),
      new Set(),
      { domains: new Map() } as unknown as DomainRegistry,
      { range2DProperties: new Map() } as unknown as CompilerVocab
    )
    expect(filters).toEqual(['FILTER(?label = "True")'])
  })
})

describe('addEnumFilter — boolean literals', () => {
  const BOOLEAN = `${XSD}boolean`

  it('compares a boolean leaf by lexical form so typed data matches', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?flag', 'True', BOOLEAN)
    expect(filters).toEqual(['FILTER(STR(?flag) IN ("true", "1"))'])
  })

  it('covers both lexical forms of false', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?flag', '0', BOOLEAN)
    expect(filters).toEqual(['FILTER(STR(?flag) IN ("false", "0"))'])
  })

  it('does not sniff the value: without a boolean datatype a "true" stays plain equality', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const untyped: string[] = []
    addEnumFilter([], untyped, '?v', 'true')
    expect(untyped).toEqual(['FILTER(?v = "true")'])
    const stringTyped: string[] = []
    addEnumFilter([], stringTyped, '?v', 'True', `${XSD}string`)
    expect(stringTyped).toEqual(['FILTER(?v = "True")'])
  })

  it('keeps plain equality for non-boolean literals', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?v', 'car')
    expect(filters).toEqual(['FILTER(?v = "car")'])
  })

  it('compares several boolean values by lexical form too (IN is defined through =)', async () => {
    // Regression: only a single boolean value used the lexical comparison, so
    // `["true", "false"]` compiled to `?v IN ("true", "false")` and, against
    // `"true"^^xsd:boolean` data, matched nothing ([SPARQL11] §17.4.1.9).
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?flag', ['true', 'FALSE', ' True '], BOOLEAN)
    expect(filters).toEqual(['FILTER(STR(?flag) IN ("true", "1", "false", "0"))'])
  })

  it('does not treat a mixed list as boolean', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?v', ['true', 'maybe'], BOOLEAN)
    expect(filters).toEqual(['FILTER(?v IN ("maybe", "true"))'])
  })

  it('does not mistake an inherited object key for a boolean form', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?v', 'constructor', BOOLEAN)
    expect(filters).toEqual(['FILTER(?v = "constructor")'])
  })
})
