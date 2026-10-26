/**
 * The pure BFS behind property-path discovery: rdfs:subClassOf inheritance
 * at intermediate classes adds classes without re-routing existing ones.
 */
import { describe, expect, it } from 'vitest'

import {
  bfsFromRoots,
  buildAncestorClosure,
  findVocabularyRoots,
  pathStepsTo,
  reachedByInheritance,
  routesFromRoots,
} from '../property-paths-graph.js'

type Edges = Map<string, { predicate: string; child: string }[]>

function edges(list: [parent: string, predicate: string, child: string][]): Edges {
  const out: Edges = new Map()
  for (const [parent, predicate, child] of list) {
    const children = out.get(parent) ?? []
    children.push({ predicate, child })
    out.set(parent, children)
  }
  return out
}

const predicatesOf = (steps: ReturnType<typeof pathStepsTo>) => steps?.map((s) => s.predicate)

describe('bfsFromRoots', () => {
  // Asset --hasPart--> Scenery; Scenery ⊑ Tag. Tag's shape owns the leaf.
  const graph = edges([['Asset', 'hasPart', 'Scenery']])
  const ancestorsOf = buildAncestorClosure([{ sub: 'Scenery', super: 'Tag' }])

  it('without ancestorsOf, a superclass of an intermediate class is unreachable', () => {
    const reached = bfsFromRoots(['Asset'], graph)
    expect(reached.has('Tag')).toBe(false)
    expect(pathStepsTo('Tag', reached, 'laneCount')).toBeNull()
  })

  it('inherits the shapes of an intermediate class’s ancestors, with no extra hop', () => {
    const reached = bfsFromRoots(['Asset'], graph, ancestorsOf)
    const steps = pathStepsTo('Tag', reached, 'laneCount')
    expect(predicatesOf(steps)).toEqual(['hasPart', 'laneCount'])
    // The hop lands on the class the predicate reached, not the ancestor.
    expect(steps?.[0]?.intermediate).toBe('Scenery')
  })

  it('follows the inherited class’s own edges too', () => {
    const withRange = edges([
      ['Asset', 'hasPart', 'Scenery'],
      ['Tag', 'laneCountRange', 'Range'],
    ])
    const reached = bfsFromRoots(['Asset'], withRange, ancestorsOf)
    expect(predicatesOf(pathStepsTo('Range', reached, 'min'))).toEqual([
      'hasPart',
      'laneCountRange',
      'min',
    ])
  })

  it('never re-routes a class that predicates alone reach', () => {
    // Tag is both an ancestor of Scenery (1 hop away) and reachable through
    // predicates (2 hops away). The predicate path must win, as it did before
    // inheritance existed, so existing paths and their SPARQL do not change.
    const both = edges([
      ['Asset', 'hasPart', 'Scenery'],
      ['Asset', 'hasLabel', 'Label'],
      ['Label', 'hasTag', 'Tag'],
    ])
    const reached = bfsFromRoots(['Asset'], both, ancestorsOf)
    expect(reached.get('Tag')?.inherited).toBeUndefined()
    expect(predicatesOf(pathStepsTo('Tag', reached, 'laneCount'))).toEqual([
      'hasLabel',
      'hasTag',
      'laneCount',
    ])
  })

  it('records the first-reached subclass as the parent of a shared ancestor', () => {
    const twoSubclasses = edges([
      ['Asset', 'hasB', 'SubB'],
      ['Asset', 'hasA', 'SubA'],
    ])
    const closure = buildAncestorClosure([
      { sub: 'SubA', super: 'Tag' },
      { sub: 'SubB', super: 'Tag' },
    ])
    const reached = bfsFromRoots(['Asset'], twoSubclasses, closure)
    // Edge order puts SubB first, so Tag is inherited through SubB.
    expect(reached.get('Tag')).toEqual({
      parent: 'SubB',
      predicate: '',
      inherited: true,
      viaInheritance: true,
    })
  })

  it('gives a class reached only through inheritance its shortest path', () => {
    // X is reachable through T1 (inherited at depth 1, then 3 hops: 4 total)
    // and through T2 (inherited at depth 5, then 1 hop: 6 total). Reach order
    // alone would pick whichever inherited class the walk met first; the
    // shorter chain must win.
    const graph = edges([
      ['Asset', 'a', 'C1'],
      ['T1', 'b', 'Y1'],
      ['Y1', 'c', 'Y2'],
      ['Y2', 'd', 'X'],
      ['Asset', 'e', 'D1'],
      ['D1', 'f', 'D2'],
      ['D2', 'g', 'D3'],
      ['D3', 'h', 'D4'],
      ['D4', 'i', 'C5'],
      ['T2', 'j', 'X'],
    ])
    const closure = buildAncestorClosure([
      { sub: 'C1', super: 'T1' },
      { sub: 'C5', super: 'T2' },
    ])
    const reached = bfsFromRoots(['Asset'], graph, closure)
    expect(predicatesOf(pathStepsTo('X', reached, 'leaf'))).toEqual(['a', 'b', 'c', 'd', 'leaf'])
    expect(reachedByInheritance('X', reached)).toBe(true)
    expect(reachedByInheritance('D4', reached)).toBe(false)
  })
})

/**
 * One class used in several contexts: each route to it is its own property
 * shape path ([SHACL] §2.3), not only the shortest one.
 */
describe('routesFromRoots', () => {
  const NS = 'http://example.org/'
  const iri = (local: string) => `${NS}${local}`
  const localsOf = (route: { predicate: string }[] | undefined) =>
    route?.map((step) => step.predicate.slice(NS.length))

  // The ego and every other road user share one manoeuvre class: four hops
  // from the asset through the ego, five through the road users.
  const graph = edges([
    ['Asset', iri('ego_behavior_model'), 'EgoBehavior'],
    ['EgoBehavior', iri('intended'), 'Intent'],
    ['Intent', iri('lane_maneuver'), 'LaneManeuver'],
    ['LaneManeuver', iri('maneuver_type'), 'ManeuverType'],
    ['Asset', iri('traffic_scenario'), 'Traffic'],
    ['Traffic', iri('road_users'), 'RoadUsers'],
    ['RoadUsers', iri('users'), 'RoadUser'],
    ['RoadUser', iri('lane_maneuver'), 'LaneManeuver'],
  ])

  it('reaches a class through every route, the breadth-first one first', () => {
    const { routes, truncated } = routesFromRoots(['Asset'], graph, 4)
    expect(routes.get('ManeuverType')?.map(localsOf)).toEqual([
      ['ego_behavior_model', 'intended', 'lane_maneuver', 'maneuver_type'],
      ['traffic_scenario', 'road_users', 'users', 'lane_maneuver', 'maneuver_type'],
    ])
    const breadthFirst = pathStepsTo('ManeuverType', bfsFromRoots(['Asset'], graph), 'code')
    expect(routes.get('ManeuverType')?.[0]).toEqual(breadthFirst?.slice(0, -1))
    expect(truncated).toEqual([])
  })

  it('records the class each hop reaches', () => {
    const [, viaUsers] = routesFromRoots(['Asset'], graph, 4).routes.get('ManeuverType') ?? []
    expect(viaUsers?.map((step) => step.intermediate)).toEqual([
      'Traffic',
      'RoadUsers',
      'RoadUser',
      'LaneManeuver',
      'ManeuverType',
    ])
  })

  it('keeps the breadth-first route first where IRI order would pick another', () => {
    const tie = edges([
      ['Asset', iri('zeta'), 'X'],
      ['Asset', iri('alpha'), 'X'],
    ])
    expect(routesFromRoots(['Asset'], tie, 4).routes.get('X')?.map(localsOf)).toEqual([
      ['zeta'],
      ['alpha'],
    ])
  })

  it('counts routes whose predicates share their local names once', () => {
    // A shape re-declaring a superclass shape's property in its own namespace.
    const redeclared = edges([
      ['Asset', `${NS}asset/hasDescription`, 'Description'],
      ['Base', `${NS}base/hasDescription`, 'Description'],
    ])
    const { routes } = routesFromRoots(['Asset', 'Base'], redeclared, 4)
    expect(routes.get('Description')?.map((r) => r.map((s) => s.predicate))).toEqual([
      [`${NS}asset/hasDescription`],
    ])
  })

  it('never passes a class twice on one route', () => {
    const cyclic = edges([
      ['Asset', iri('a'), 'B'],
      ['B', iri('b'), 'C'],
      ['C', iri('c'), 'B'],
      ['C', iri('d'), 'D'],
      ['C', iri('e'), 'Asset'],
    ])
    const { routes } = routesFromRoots(['Asset'], cyclic, 4)
    expect(routes.get('B')?.map(localsOf)).toEqual([['a']])
    expect(routes.get('D')?.map(localsOf)).toEqual([['a', 'b', 'd']])
    expect(routes.has('Asset')).toBe(false)
  })

  it('keeps at most the cap per class, the rest in IRI order, and names the class', () => {
    const fan = (order: string[]) =>
      edges(order.map((p): [string, string, string] => ['Asset', iri(p), 'X']))
    const kept = (order: string[]) =>
      routesFromRoots(['Asset'], fan(order), 2).routes.get('X')?.map(localsOf)
    // The breadth-first route depends on edge order, as it always has; the
    // routes kept after it do not.
    expect(kept(['p3', 'p2', 'p1'])).toEqual([['p3'], ['p1']])
    expect(kept(['p2', 'p3', 'p1'])).toEqual([['p2'], ['p1']])
    expect(routesFromRoots(['Asset'], fan(['p1', 'p2', 'p3']), 2).truncated).toEqual(['X'])
  })

  it('does not continue a route it does not keep', () => {
    const fanThenHop = edges([
      ['Asset', iri('p1'), 'X'],
      ['Asset', iri('p2'), 'X'],
      ['Asset', iri('p3'), 'X'],
      ['X', iri('q'), 'Y'],
    ])
    const { routes, truncated } = routesFromRoots(['Asset'], fanThenHop, 2)
    expect(routes.get('Y')?.map(localsOf)).toEqual([
      ['p1', 'q'],
      ['p2', 'q'],
    ])
    // Continuing the dropped route would have offered Y a third one.
    expect(truncated).toEqual(['X'])
  })
})

/**
 * Standalone vocabulary entry points: a non-asset vocabulary class that owns
 * properties but is never the value class of a composition edge
 * ([SHACL] §4.7.1 `sh:node`) can be the type of an unattached document.
 */
describe('findVocabularyRoots', () => {
  const domainOf = (iri: string): string | undefined => iri.split(':')[0]
  const parents: Record<string, string[]> = {
    'voc:SubTag': ['voc:Tag'],
    'asset:Thing': ['base:Resource'],
  }
  const ancestorsOf = (cls: string): Set<string> => new Set([cls, ...(parents[cls] ?? [])])
  const base = {
    assetClasses: ['asset:Thing'],
    assetDomains: new Set(['asset']),
    ancestorsOf,
    domainOf,
  }

  it('returns the top-level class of a non-asset vocabulary', () => {
    const roots = findVocabularyRoots({
      ...base,
      edges: [
        { parentClass: 'asset:Thing', childClass: 'asset:Content' },
        { parentClass: 'voc:Tag', childClass: 'voc:Odd' },
      ],
      leafOwners: ['voc:Odd', 'asset:Content'],
    })
    expect(roots).toEqual([{ domain: 'voc', rootClass: 'voc:Tag' }])
  })

  it('excludes nested classes, including subclasses of a nested class', () => {
    const roots = findVocabularyRoots({
      ...base,
      edges: [
        { parentClass: 'asset:Content', childClass: 'voc:Tag' },
        { parentClass: 'voc:Tag', childClass: 'voc:Odd' },
      ],
      leafOwners: ['voc:SubTag'],
    })
    expect(roots).toEqual([])
  })

  it('ignores asset domains, unknown domains and ancestors of asset classes', () => {
    const roots = findVocabularyRoots({
      ...base,
      domainOf: (iri) => (iri.startsWith('ghost:') ? undefined : domainOf(iri)),
      edges: [{ parentClass: 'voc:Tag', childClass: 'voc:Tag' }],
      leafOwners: ['asset:Thing', 'base:Resource', 'ghost:Thing', 'voc:Tag'],
    })
    // A self-loop edge does not make `voc:Tag` nested.
    expect(roots).toEqual([{ domain: 'voc', rootClass: 'voc:Tag' }])
  })

  it('is sorted by domain then class', () => {
    const roots = findVocabularyRoots({
      ...base,
      edges: [],
      leafOwners: ['zz:B', 'aa:Z', 'zz:A'],
    })
    expect(roots.map((r) => r.rootClass)).toEqual(['aa:Z', 'zz:A', 'zz:B'])
  })
})
