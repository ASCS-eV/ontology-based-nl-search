/**
 * The pure BFS behind property-path discovery: rdfs:subClassOf inheritance
 * at intermediate classes adds classes without re-routing existing ones.
 */
import { describe, expect, it } from 'vitest'

import { bfsFromRoots, buildAncestorClosure, pathStepsTo } from '../property-paths-graph.js'

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
    expect(reached.get('Tag')).toEqual({ parent: 'SubB', predicate: '', inherited: true })
  })
})
