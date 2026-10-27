/**
 * A class reachable from the asset by several routes: one manoeuvre class
 * shared by the ego and by every other road user. Each route is a different
 * sequence path from the asset ([SHACL] §2.3.1.2), so each must be
 * searchable, each under its own key, and the bare leaf name must still match
 * all of them (ADR 0009 alternatives, compiled to one UNION group).
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { resetLogLevel, setLogLevel } from '@ontology-search/core/logging'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it, vi } from 'vitest'

import { buildDomainPatterns } from '../compiler-domain-patterns.js'
import { lookupDomainSpecPredicate, resolveKey } from '../compiler-helpers-paths.js'
import { type CompilerVocab, isKeyedPath } from '../compiler-vocab.js'
import { indexPropertyKeys } from '../property-keys.js'
import { buildReferenceChains, emitPaths, MAX_ROUTES_PER_CLASS } from '../property-paths.js'
import type { LeafKind, PropertyPath } from '../property-paths-types.js'

const NS = 'http://example.org/scenario/v1/'
const SHARED = 'http://example.org/shared/v1/'

//   Scenario → ego_behavior_model → intended → lane_maneuver → maneuver_type → code
//   Scenario → traffic_scenario → road_users → users → lane_maneuver → maneuver_type → code
const forwardEdges = new Map<string, { predicate: string; child: string }[]>()
for (const [parent, predicate, child] of [
  ['Scenario', 'ego_behavior_model', 'EgoBehavior'],
  ['EgoBehavior', 'intended', 'Intent'],
  ['Intent', 'lane_maneuver', 'LaneManeuver'],
  ['LaneManeuver', 'maneuver_type', 'ManeuverType'],
  ['Scenario', 'traffic_scenario', 'Traffic'],
  ['Traffic', 'road_users', 'RoadUsers'],
  ['RoadUsers', 'users', 'RoadUser'],
  ['RoadUser', 'lane_maneuver', 'LaneManeuver'],
] as const) {
  const children = forwardEdges.get(`${NS}${parent}`) ?? []
  children.push({ predicate: `${NS}${predicate}`, child: `${NS}${child}` })
  forwardEdges.set(`${NS}${parent}`, children)
}

const pathsFor = (leafKind: LeafKind = 'literal'): PropertyPath[] =>
  emitPaths(
    [{ domainName: 'scenario', assetClass: `${NS}Scenario` }],
    [{ owningClass: `${NS}ManeuverType`, propertyIri: `${SHARED}code`, leafKind }],
    forwardEdges,
    (cls) => new Set([cls])
  )
const localsOf = (path: PropertyPath | undefined) =>
  path?.steps.map((step) => step.predicate.replace(NS, '').replace(SHARED, ''))

describe('emitPaths — a class reachable by several routes', () => {
  it('emits a path for every route, the breadth-first one unchanged and first', () => {
    const [shortest, other, ...rest] = pathsFor()
    expect(rest).toEqual([])
    expect(localsOf(shortest)).toEqual([
      'ego_behavior_model',
      'intended',
      'lane_maneuver',
      'maneuver_type',
      'code',
    ])
    expect(shortest?.alternateRoute).toBeUndefined()
    expect(localsOf(other)).toEqual([
      'traffic_scenario',
      'road_users',
      'users',
      'lane_maneuver',
      'maneuver_type',
      'code',
    ])
    expect(other?.alternateRoute).toBe(true)
    expect(other?.owningClass).toBe(`${NS}ManeuverType`)
  })

  it('keys each route by the hops that tell it apart', () => {
    const { byKey } = indexPropertyKeys(pathsFor())
    expect(localsOf(byKey.get('scenario:intended__lane_maneuver__maneuver_type__code'))?.[0]).toBe(
      'ego_behavior_model'
    )
    expect(localsOf(byKey.get('scenario:users__lane_maneuver__maneuver_type__code'))?.[0]).toBe(
      'traffic_scenario'
    )
  })

  it('lets the bare leaf name match every route', () => {
    const { byKey, alternatives } = indexPropertyKeys(pathsFor())
    const resolved = resolveKey(byKey, alternatives, 'scenario:code', 'cut_in')
    expect(resolved.kind).toBe('alternatives')
    expect(resolved.kind === 'alternatives' && resolved.paths.map((p) => localsOf(p)?.[0])).toEqual(
      ['ego_behavior_model', 'traffic_scenario']
    )
  })

  it('compiles the bare leaf name to one UNION over both routes', () => {
    const { byKey, alternatives } = indexPropertyKeys(pathsFor())
    const vocab = {
      properties: new Map(),
      shapeGroups: new Map(),
      shapeGroupPropertyNames: new Set<string>(),
      range2DProperties: new Map(),
      paths: byKey,
      alternatives,
    } as unknown as CompilerVocab
    const patterns: string[] = []
    buildDomainPatterns(
      'scenario',
      { prefix: 'scenario', namespace: NS } as never,
      { code: 'cut_in' },
      {},
      patterns,
      [],
      [],
      new Set(),
      vocab,
      { domains: new Map() } as unknown as DomainRegistry,
      '?asset',
      '?spec'
    )
    const union = patterns.filter((p) => p.includes('UNION'))
    expect(union).toHaveLength(1)
    expect(union[0]).toMatch(/ego_behavior_model/)
    expect(union[0]).toMatch(/traffic_scenario/)
  })

  it('keeps the leaves of one class on one node of each route', () => {
    // Asset → origin → Position, Asset → view_point → Position; Position has
    // a latitude and a longitude. A box on both must hold for ONE point:
    // the origin's latitude with the view point's longitude is no match.
    const point = new Map([
      [
        `${NS}Scenario`,
        [
          { predicate: `${NS}origin`, child: `${NS}Position` },
          { predicate: `${NS}view_point`, child: `${NS}Position` },
        ],
      ],
    ])
    const paths = emitPaths(
      [{ domainName: 'scenario', assetClass: `${NS}Scenario` }],
      ['lat', 'lon'].map((leaf) => ({
        owningClass: `${NS}Position`,
        propertyIri: `${NS}${leaf}`,
        leafKind: 'literal' as const,
      })),
      point,
      (cls) => new Set([cls])
    )
    const { byKey, alternatives } = indexPropertyKeys(paths)
    const vocab = {
      properties: new Map(),
      shapeGroups: new Map(),
      shapeGroupPropertyNames: new Set<string>(),
      range2DProperties: new Map(),
      paths: byKey,
      alternatives,
    } as unknown as CompilerVocab
    const patterns: string[] = []
    buildDomainPatterns(
      'scenario',
      { prefix: 'scenario', namespace: NS } as never,
      {},
      { lat: { min: 48, max: 49 }, lon: { min: 11, max: 12 } },
      patterns,
      [],
      [],
      new Set(),
      vocab,
      { domains: new Map() } as unknown as DomainRegistry,
      '?asset',
      '?spec'
    )
    const unions = patterns.filter((p) => p.includes('UNION'))
    expect(unions).toHaveLength(1)
    const branches = unions[0]!.split('UNION')
    expect(branches).toHaveLength(2)
    for (const branch of branches) {
      const node = /\?asset \S+ (\?\S+) \./.exec(branch)?.[1]
      expect(branch).toContain(`${node} <${NS}lat> `)
      expect(branch).toContain(`${node} <${NS}lon> `)
    }
  })

  it('keeps at most MAX_ROUTES_PER_CLASS routes to one class', () => {
    const fan = new Map([
      [
        `${NS}Scenario`,
        Array.from({ length: MAX_ROUTES_PER_CLASS + 2 }, (_, i) => ({
          predicate: `${NS}via${i}`,
          child: `${NS}Shared`,
        })),
      ],
    ])
    const paths = emitPaths(
      [{ domainName: 'scenario', assetClass: `${NS}Scenario` }],
      [{ owningClass: `${NS}Shared`, propertyIri: `${SHARED}code`, leafKind: 'literal' }],
      fan,
      (cls) => new Set([cls])
    )
    expect(paths).toHaveLength(MAX_ROUTES_PER_CLASS)
  })

  it('names a class with more routes than it keeps', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setLogLevel('warn')
    try {
      emitPaths(
        [{ domainName: 'scenario', assetClass: `${NS}Scenario` }],
        [{ owningClass: `${NS}Shared`, propertyIri: `${SHARED}code`, leafKind: 'literal' }],
        new Map([
          [
            `${NS}Scenario`,
            Array.from({ length: MAX_ROUTES_PER_CLASS + 1 }, (_, i) => ({
              predicate: `${NS}via${i}`,
              child: `${NS}Shared`,
            })),
          ],
        ]),
        (cls) => new Set([cls])
      )
      const logged = warn.mock.calls.map((call) => String(call[0])).join('\n')
      expect(logged).toContain('more routes than are kept')
      expect(logged).toContain(`${NS}Shared`)
    } finally {
      resetLogLevel()
      warn.mockRestore()
    }
  })

  it('pairs leaves by node only where each node is reached once', () => {
    // Two leaf IRIs of one local name on one class: both chains of `value`
    // end on the same node, so branch-by-branch pairing with `unit` would
    // skip the pairs across the two IRIs. Such names keep a group each.
    const route = { predicate: `${NS}measure`, intermediate: `${NS}Measurement` }
    const leaf = (ns: string, name: string): PropertyPath => ({
      domain: 'scenario',
      propertyName: name,
      propertyIri: `${ns}${name}`,
      assetClass: `${NS}Scenario`,
      owningClass: `${NS}Measurement`,
      leafKind: 'literal',
      steps: [route, { predicate: `${ns}${name}` }],
    })
    const twice = (name: string) => [leaf(NS, name), leaf(SHARED, name)]
    const vocab = {
      properties: new Map(),
      shapeGroups: new Map(),
      shapeGroupPropertyNames: new Set<string>(),
      range2DProperties: new Map(),
      paths: new Map(),
      alternatives: new Map([
        ['scenario:value', twice('value')],
        ['scenario:unit', twice('unit')],
      ]),
    } as unknown as CompilerVocab
    const patterns: string[] = []
    buildDomainPatterns(
      'scenario',
      { prefix: 'scenario', namespace: NS } as never,
      { value: '5', unit: 'm' },
      {},
      patterns,
      [],
      [],
      new Set(),
      vocab,
      { domains: new Map() } as unknown as DomainRegistry,
      '?asset',
      '?spec'
    )
    expect(patterns.filter((p) => p.includes('UNION'))).toHaveLength(2)
  })

  it('reads a group name made ambiguous only by further routes as its breadth-first chain', () => {
    // The specification hop of a domain comes from the alphabetically first
    // shape-group name with a path; further routes must not move it.
    const [shortest, other] = pathsFor()
    const vocab = {
      shapeGroupPropertyNames: new Set(['code', 'zone']),
      paths: new Map([
        [
          'scenario:zone',
          { ...shortest!, steps: [{ predicate: `${NS}elsewhere` }, ...shortest!.steps.slice(1)] },
        ],
      ]),
      alternatives: new Map([['scenario:code', [shortest!, other!]]]),
    } as unknown as CompilerVocab
    expect(
      lookupDomainSpecPredicate(vocab, {
        name: 'scenario',
        prefix: 'scenario',
        namespace: NS,
      } as never)
    ).toBe('scenario:ego_behavior_model')
  })

  it('does not count a chain one asset class reaches breadth-first as an alternate route', () => {
    const [shortest] = pathsFor()
    const same = { ...shortest!, assetClass: `${NS}Other`, alternateRoute: true as const }
    const { byKey } = indexPropertyKeys([same, shortest!])
    expect(byKey.get('scenario:code')?.alternateRoute).toBeUndefined()
  })

  it('keys a further route to a shape-group property like any other chain', () => {
    // Only an `extended` path stays off a shape-group name: a further route
    // is a property of its own ([SHACL] §2.3), whatever its leaf name.
    const [, other] = pathsFor()
    expect(isKeyedPath(other!, new Set(['code']))).toBe(true)
    expect(isKeyedPath({ ...other!, extended: true }, new Set(['code']))).toBe(false)
  })

  it('keeps alternate routes out of reference chains', () => {
    // The compiler joins assets through the shortest chain; an alternate
    // route of equal length could otherwise displace the join it compiles to.
    const chains = buildReferenceChains(pathsFor('iri'))
    expect(chains).toHaveLength(1)
    expect(chains[0]?.steps.map((step) => step.predicate.replace(NS, ''))[0]).toBe(
      'ego_behavior_model'
    )
  })
})
