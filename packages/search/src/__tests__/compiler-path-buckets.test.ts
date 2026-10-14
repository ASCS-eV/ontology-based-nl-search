import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it } from 'vitest'

import { emitDirectPathFilters, pathPrefixKey } from '../compiler-helpers-paths.js'
import type { CompilerVocab } from '../compiler-vocab.js'
import type { PropertyPath } from '../property-paths.js'

const NS = 'http://example.org/'
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
 * multi-valued predicate ([SHACL] §4.6.2) live on DIFFERENT value nodes.
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

describe('addEnumFilter — boolean literals', () => {
  it('compares a boolean value by lexical form so typed data matches', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?flag', 'True')
    expect(filters).toEqual(['FILTER(STR(?flag) = "true")'])
  })

  it('keeps plain equality for non-boolean literals', async () => {
    const { addEnumFilter } = await import('../compiler-helpers-primitives.js')
    const filters: string[] = []
    addEnumFilter([], filters, '?v', 'car')
    expect(filters).toEqual(['FILTER(?v = "car")'])
  })
})
