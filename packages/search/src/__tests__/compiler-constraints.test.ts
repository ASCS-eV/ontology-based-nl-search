/**
 * `groupConstraints` and `emitConstraintGroups`: bare ambiguous names
 * (ADR 0009) that can end on a common node hold on one node of each largest
 * set of them that shares one; everything else passes through as a single.
 */
import { describe, expect, it } from 'vitest'

import { type Constraint, emitConstraintGroups, groupConstraints } from '../compiler-constraints.js'
import { buildStandaloneArms } from '../compiler-standalone.js'
import type { CompilerVocab } from '../compiler-vocab.js'
import type { PropertyPath } from '../property-paths-types.js'
import { syntheticRegistry } from './__fixtures__/synthetic-registry.js'

const NS = 'http://example.org/fleet/v1/'

/** A chain `spec → hop → <cls> → leaf`; `owners` lists every declaring class. */
const chain = (hop: string, cls: string, leaf: string, owners?: string[]): PropertyPath => ({
  domain: 'fleet',
  propertyName: leaf,
  propertyIri: `${NS}${leaf}`,
  assetClass: `${NS}Vehicle`,
  owningClass: `${NS}${cls}`,
  ...(owners ? { owningClasses: owners.map((owner) => `${NS}${owner}`) } : {}),
  leafKind: 'literal',
  steps: [
    { predicate: `${NS}hasSpec`, intermediate: `${NS}Spec` },
    { predicate: `${NS}${hop}`, intermediate: `${NS}${cls}` },
    { predicate: `${NS}${leaf}` },
  ],
})

const bare = (key: string, paths: PropertyPath[]): Constraint => ({
  kind: 'filter',
  key,
  value: 'x',
  paths,
  bare: true,
})

/** Each group as `member+member: hop hop | hop hop`, a branch's hops per member. */
const shape = (constraints: Constraint[]) => {
  const { groups, singles } = groupConstraints(constraints)
  const hop = (path: PropertyPath) => path.steps[1]!.predicate.slice(NS.length)
  return {
    groups: groups.map(
      (group) =>
        `${group.members.map((member) => member.key).join('+')}: ${group.branches
          .map((branch) => branch.map(hop).join(' '))
          .join(' | ')}`
    ),
    singles: singles.map((single) => single.key),
  }
}

describe('groupConstraints', () => {
  it('holds overlapping bare names on the nodes they share', () => {
    const code = bare('code', [chain('others', 'M', 'code'), chain('ego', 'M', 'code')])
    const reason = bare('reason', [
      chain('ego', 'M', 'reason'),
      chain('others', 'M', 'reason'),
      chain('road', 'R', 'reason'),
    ])
    expect(shape([reason, code])).toEqual({
      groups: ['code+reason: others others | ego ego'],
      singles: [],
    })
  })

  it('holds a name on the one node a value narrowed its sibling to', () => {
    const code = bare('code', [chain('road', 'R', 'code')])
    const reason = bare('reason', [chain('ego', 'M', 'reason'), chain('road', 'R', 'reason')])
    expect(shape([code, reason]).groups).toEqual(['code+reason: road road'])
  })

  it('leaves bare names that share no node apart, and a lone narrowed one single', () => {
    const a = bare('a', [chain('ego', 'M', 'a'), chain('others', 'M', 'a')])
    const b = bare('b', [chain('road', 'R', 'b'), chain('lane', 'L', 'b')])
    const c = bare('c', [chain('depot', 'D', 'c')])
    expect(shape([a, b, c])).toEqual({
      groups: ['a: ego | others', 'b: road | lane'],
      singles: ['c'],
    })
  })

  it('ties a name once to each largest set of names it can share a node with', () => {
    // code and unit share no node; reason shares the manoeuvres with code and
    // the road with unit. Adding unit to {code, reason} must only narrow it.
    const code = bare('code', [chain('ego', 'M', 'code'), chain('others', 'M', 'code')])
    const reason = bare('reason', [
      chain('ego', 'M', 'reason'),
      chain('others', 'M', 'reason'),
      chain('road', 'R', 'reason'),
    ])
    const unit = bare('unit', [chain('road', 'R', 'unit'), chain('extra', 'X', 'unit')])
    expect(shape([code, reason, unit]).groups).toEqual([
      'code+reason: ego ego | others others',
      'reason+unit: road road',
    ])
  })

  it('holds names whose nodes are all the same on one node, all of them at once', () => {
    const names = ['lat', 'lon', 'alt'].map((leaf) =>
      bare(leaf, [chain('origin', 'P', leaf), chain('view', 'P', leaf)])
    )
    expect(shape(names).groups).toEqual(['alt+lat+lon: origin origin origin | view view view'])
  })

  it('leaves a name that reaches one node twice in a group of its own', () => {
    const twice = bare('value', [
      chain('ego', 'M', 'value'),
      { ...chain('ego', 'M', 'value'), propertyIri: 'http://example.org/other/value' },
    ])
    const unit = bare('unit', [chain('ego', 'M', 'unit'), chain('road', 'R', 'unit')])
    expect(shape([twice, unit]).groups).toEqual(['unit: ego | road', 'value: ego | ego'])
  })

  it('finds the node two names share behind a predicate several classes declare a leaf on', () => {
    // `p` reaches an A or a B; both declare `code`, so its one chain names A
    // but stands for a B node too, which is where `reason` sits.
    const code = bare('code', [chain('p', 'A', 'code', ['A', 'B']), chain('q', 'C', 'code')])
    const reason = bare('reason', [chain('p', 'B', 'reason'), chain('q', 'C', 'reason')])
    expect(shape([code, reason]).groups).toEqual(['code+reason: p p | q q'])
  })

  it('groups the same whatever order the slots name the keys in', () => {
    const code = bare('code', [chain('ego', 'M', 'code'), chain('sub', 'M', 'code')])
    const value = bare('value', [chain('sub', 'M', 'value'), chain('ego', 'M', 'value')])
    expect(groupConstraints([code, value])).toEqual(groupConstraints([value, code]))
  })

  it('passes every other constraint through as a single, in order', () => {
    const qualified: Constraint = { ...bare('ego__code', [chain('ego', 'M', 'code')]), bare: false }
    const unknown: Constraint = { ...bare('nothing', []), bare: false }
    expect(shape([unknown, qualified])).toEqual({ groups: [], singles: ['nothing', 'ego__code'] })
  })
})

describe('emitConstraintGroups', () => {
  it('gives a name in two groups a variable of its own in each', () => {
    const code = bare('code', [chain('ego', 'M', 'code')])
    const reason = bare('reason', [chain('ego', 'M', 'reason'), chain('road', 'R', 'reason')])
    const unit = bare('unit', [chain('road', 'R', 'unit')])
    const { groups } = groupConstraints([code, reason, unit])
    const patterns: string[] = []
    const vocab = { range2DProperties: new Map() } as unknown as CompilerVocab
    const registry = syntheticRegistry([{ name: 'fleet', namespace: NS, assetClass: 'Vehicle' }])
    emitConstraintGroups(
      'fleet',
      groups,
      '?asset',
      '',
      patterns,
      new Set(),
      new Set(),
      registry,
      vocab
    )
    expect(patterns).toHaveLength(2)
    expect(patterns[0]).toContain('fleet:reason ?reason .')
    expect(patterns[1]).toContain('fleet:reason ?reason_2 .')
  })
})

describe('buildStandaloneArms', () => {
  it('holds the bare names of a standalone document on a node they share', () => {
    const route = (hop: string, cls: string, leaf: string): PropertyPath => ({
      ...chain(hop, cls, leaf),
      steps: [
        { predicate: `${NS}${hop}`, intermediate: `${NS}${cls}` },
        { predicate: `${NS}${leaf}` },
      ],
    })
    const root = {
      rootClass: `${NS}Log`,
      paths: new Map(),
      alternatives: new Map([
        ['code', [route('ego', 'M', 'code'), route('road', 'R', 'code')]],
        ['reason', [route('ego', 'M', 'reason'), route('others', 'M', 'reason')]],
      ]),
    }
    const vocab = {
      paths: new Map(),
      alternatives: new Map(),
      range2DProperties: new Map(),
      vocabularyRoots: new Map([['fleet', [root]]]),
    } as unknown as CompilerVocab
    const registry = syntheticRegistry([{ name: 'fleet', namespace: NS, assetClass: 'Vehicle' }])
    const [arm] = buildStandaloneArms(
      'fleet',
      { domains: ['fleet'], filters: { code: 'x', reason: 'y' }, ranges: {} },
      registry,
      vocab,
      new Set(),
      new Set()
    )
    // One group, one branch: the ego's node, where both names can sit.
    expect(arm!.match(/UNION/g)).toBeNull()
    expect(arm).toMatch(
      /\?asset fleet:ego (\?\S+) \.\s+\1 fleet:code \?code \.\s+\1 fleet:reason \?reason \./
    )
  })
})
