/**
 * Property keys (ADR 0009): one slot key per predicate chain, assigned
 * deterministically from the chains alone. Synthetic paths, no ontology.
 */
import { describe, expect, it } from 'vitest'

import { leafVariable } from '../compiler-helpers-primitives.js'
import { indexPropertyKeys, pathsThatCanHold } from '../property-keys.js'
import type { PropertyPath } from '../property-paths.js'

const EX = 'http://example.org/ex/'
const OTHER = 'http://example.org/other/'

/** A path from `ex:Car` through `predicates` (IRIs); the last one is the leaf. */
function path(
  predicates: string[],
  options: Partial<Pick<PropertyPath, 'allowedValues' | 'owningClass' | 'assetClass'>> = {}
): PropertyPath {
  const leaf = predicates[predicates.length - 1]!
  return {
    domain: 'ex',
    propertyName: leaf.replace(/.*[/#]/, ''),
    propertyIri: leaf,
    assetClass: options.assetClass ?? `${EX}Car`,
    steps: predicates.map((predicate) => ({ predicate })),
    leafKind: 'literal',
    ...(options.owningClass ? { owningClass: options.owningClass } : {}),
    ...(options.allowedValues ? { allowedValues: options.allowedValues } : {}),
  }
}

const keysOf = (paths: PropertyPath[]) =>
  [...indexPropertyKeys(paths).byKey]
    .map(
      ([key, p]) => `${key} → ${p.steps.map((s) => s.predicate.replace(/.*[/#]/, '')).join('/')}`
    )
    .sort()

describe('indexPropertyKeys', () => {
  it('keeps the leaf name as the key of a leaf reached one way', () => {
    expect(keysOf([path([`${EX}colour`]), path([`${EX}spec`, `${EX}size`])])).toEqual([
      'ex:colour → colour',
      'ex:size → spec/size',
    ])
  })

  it('gives each chain of a shared leaf the shortest suffix only it has (value objects)', () => {
    const paths = [
      path([`${EX}colour`, `${EX}value`]),
      path([`${EX}size`, `${EX}value`]),
      path([`${EX}spec`, `${EX}colour`, `${EX}value`]),
    ]
    expect(keysOf(paths)).toEqual(
      [
        'ex:size__value → size/value',
        'ex:spec__colour__value → spec/colour/value',
        'ex:colour__value → colour/value',
      ].sort()
    )
    const { alternatives } = indexPropertyKeys(paths)
    expect(alternatives.get('ex:value')?.map((p) => p.steps.length)).toEqual([2, 2, 3])
  })

  it('leads a chain no suffix tells apart with its owning class, and never uses the bare name', () => {
    // A one-step leaf in two namespaces, plus a longer chain whose tail it is.
    const paths = [
      path([`${EX}description`], { owningClass: `${EX}Car` }),
      path([`${OTHER}description`], { owningClass: `${OTHER}Resource` }),
      path([`${EX}spec`, `${OTHER}description`], { owningClass: `${EX}Spec` }),
    ]
    const { byKey, alternatives } = indexPropertyKeys(paths)
    expect([...byKey.keys()].sort()).toEqual([
      'ex:Car__description',
      'ex:Resource__description',
      'ex:spec__description',
    ])
    expect(byKey.has('ex:description')).toBe(false)
    expect(alternatives.get('ex:description')).toHaveLength(3)
  })

  it('falls back to an ordinal only for chains that still coincide', () => {
    const paths = [
      path([`${EX}note`], { owningClass: `${EX}Car` }),
      path([`${OTHER}note`], { owningClass: `${OTHER}Car` }),
    ]
    expect([...indexPropertyKeys(paths).byKey.keys()].sort()).toEqual([
      'ex:Car__note',
      'ex:Car__note__2',
    ])
  })

  it('never lets a qualified key shadow a leaf name the domain already uses', () => {
    const paths = [
      path([`${EX}colour`, `${EX}value`]),
      path([`${EX}size`, `${EX}value`]),
      path([`${EX}colour__value`]),
    ]
    const keys = [...indexPropertyKeys(paths).byKey.keys()].sort()
    expect(keys).toContain('ex:colour__value')
    expect(new Set(keys).size).toBe(3)
    expect(indexPropertyKeys(paths).byKey.get('ex:colour__value')?.steps).toHaveLength(1)
  })

  it('treats equal predicate chains as one property, carrying the values of all', () => {
    const shared = [`${EX}spec`, `${EX}level`]
    const { byKey, alternatives } = indexPropertyKeys([
      path(shared, { assetClass: `${EX}B`, allowedValues: ['high'] }),
      path(shared, { assetClass: `${EX}A`, allowedValues: ['low'] }),
    ])
    expect(alternatives.size).toBe(0)
    expect(byKey.get('ex:level')?.assetClass).toBe(`${EX}A`)
    expect(byKey.get('ex:level')?.allowedValues).toEqual(['high', 'low'])
  })

  it('leaves a shared chain open when one of its shapes declares no sh:in', () => {
    const shared = [`${EX}spec`, `${EX}level`]
    const { byKey } = indexPropertyKeys([
      path(shared, { assetClass: `${EX}A`, allowedValues: ['low'] }),
      path(shared, { assetClass: `${EX}B` }),
    ])
    expect(byKey.get('ex:level')?.allowedValues).toBeUndefined()
  })

  it('picks the same owner for a leaf declared at several levels, whatever the order', () => {
    // One chain, three declaring shapes (an inherited property); plus a second
    // chain, so the owner leads the key of the one-step chain.
    const declared = (owner: string) => path([`${OTHER}description`], { owningClass: owner })
    const owners = [`${OTHER}Resource`, `${OTHER}Entity`, `${OTHER}VirtualResource`]
    const other = path([`${EX}description`], { owningClass: `${EX}Car` })
    const orders = [owners, [...owners].reverse(), [owners[1]!, owners[2]!, owners[0]!]]
    const results = orders.map((order) => {
      const { byKey } = indexPropertyKeys([...order.map(declared), other])
      return [...byKey].map(([key, p]) => `${key} ${p.owningClass} ${p.owningClasses?.join(',')}`)
    })
    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
    expect(results[0]).toContain(
      `ex:Entity__description ${OTHER}Entity ${[...owners].sort().join(',')}`
    )
  })

  it('reads a chain one of its classes declares itself as no inherited leaf', () => {
    // A superclass shape declares the leaf too, and sorts first: the node the
    // chain reaches still carries it, so it is no leaf of an unknown node.
    const route = [`${EX}consumer`, `${OTHER}description`]
    const inherited: PropertyPath = {
      ...path(route, { owningClass: `${OTHER}Entity` }),
      inheritedLeaf: true,
    }
    const own = path(route, { owningClass: `${OTHER}Participant` })
    for (const order of [
      [inherited, own],
      [own, inherited],
    ]) {
      expect(indexPropertyKeys(order).byKey.get('ex:description')?.inheritedLeaf).toBeUndefined()
    }
    expect(indexPropertyKeys([inherited]).byKey.get('ex:description')?.inheritedLeaf).toBe(true)
  })

  it('does not depend on the order the paths arrive in', () => {
    const paths = [
      path([`${EX}colour`, `${EX}value`], { allowedValues: ['red'] }),
      path([`${EX}size`, `${EX}value`], { allowedValues: ['L'] }),
      path([`${EX}description`], { owningClass: `${EX}Car` }),
      path([`${OTHER}description`], { owningClass: `${OTHER}Resource` }),
    ]
    const forward = keysOf(paths)
    expect(keysOf([...paths].reverse())).toEqual(forward)
    expect(keysOf([paths[2]!, paths[0]!, paths[3]!, paths[1]!])).toEqual(forward)
  })
})

describe('pathsThatCanHold', () => {
  const colour = path([`${EX}colour`, `${EX}value`], { allowedValues: ['blue', 'red'] })
  const size = path([`${EX}size`, `${EX}value`], { allowedValues: ['L', 'S'] })
  const note = path([`${EX}note`, `${EX}value`])

  it('keeps the chains whose own sh:in has the value, and the open ones', () => {
    expect(pathsThatCanHold([colour, size, note], 'red')).toEqual([colour, note])
    expect(pathsThatCanHold([colour, size], 'red')).toEqual([colour])
  })

  it('keeps a chain that can hold any of several values (IN semantics)', () => {
    expect(pathsThatCanHold([colour, size], ['red', 'L'])).toEqual([colour, size])
  })

  it('matches an enumerated IRI by its local name, as the validator spells it', () => {
    const kind = path([`${EX}kind`, `${EX}value`], { allowedValues: [`${EX}Sedan`] })
    expect(pathsThatCanHold([kind, size], 'Sedan')).toEqual([kind])
  })

  it('keeps every chain when none can hold the value, so nothing is dropped silently', () => {
    expect(pathsThatCanHold([colour, size], 'purple')).toEqual([colour, size])
  })
})

describe('leafVariable', () => {
  it('turns a key into a SPARQL variable name ([SPARQL11] §19.8, rule 166)', () => {
    expect(leafVariable('dataRate__value')).toBe('?dataRate__value')
    expect(leafVariable('lane-count', '_hdmap')).toBe('?lane_count_hdmap')
    expect(leafVariable('speed', '', 'Max')).toBe('?speedMax')
  })

  it('never rebinds the variables the query projects for itself', () => {
    expect(leafVariable('name')).toBe('?name_')
    expect(leafVariable('asset')).toBe('?asset_')
  })
})
