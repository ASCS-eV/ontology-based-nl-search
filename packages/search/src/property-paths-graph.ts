/**
 * Property-path graph traversal (ADR 0003) — pure ancestor-closure + BFS over
 * the resolved SHACL edge graph, producing the predicate-hop path to each leaf.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'

import { type PathStep } from './property-paths-types.js'

export interface PredecessorLink {
  parent: string
  predicate: string
  /**
   * The class was reached as an `rdfs:subClassOf` ancestor of `parent`, not
   * through a predicate: a node of `parent` is also an instance of this
   * class, so there is no hop and no path step.
   */
  inherited?: boolean
  /** The walk from a root to this class crosses at least one inherited link. */
  viaInheritance?: boolean
}

/**
 * Build a memoized `class -> {class} ∪ transitive rdfs:subClassOf ancestors`
 * resolver from the discovered subclass edges. Self-referential and cyclic
 * `subClassOf` declarations are tolerated (the result set is seeded before
 * recursing, so a cycle terminates).
 */

export function buildAncestorClosure(
  edges: { sub: string; super: string }[]
): (cls: string) => Set<string> {
  const parents = new Map<string, Set<string>>()
  for (const { sub, super: sup } of edges) {
    if (!sub || !sup || sub === sup) continue
    const set = parents.get(sub) ?? new Set<string>()
    set.add(sup)
    parents.set(sub, set)
  }
  const memo = new Map<string, Set<string>>()
  const resolve = (cls: string): Set<string> => {
    const cached = memo.get(cls)
    if (cached) return cached
    const acc = new Set<string>([cls])
    memo.set(cls, acc) // seed before recursing so cycles terminate
    for (const parent of parents.get(cls) ?? []) {
      for (const ancestor of resolve(parent)) acc.add(ancestor)
    }
    return acc
  }
  return resolve
}

/**
 * BFS from a set of `roots` through the edge graph; return predecessor
 * links keyed by reached target class. Used to reconstruct a path by
 * walking predecessors in reverse from a leaf's owning class.
 *
 * The roots are the asset class **and all its `rdfs:subClassOf`
 * ancestors**: by SHACL/RDFS semantics a shape targeting a superclass
 * constrains the subclass's instances, so the superclass's leaves are
 * direct properties of the asset (zero intermediate hops) and the
 * superclass's composition edges are inherited too. Seeding every
 * ancestor as a zero-hop root makes both fall out of the same BFS.
 *
 * The same holds below the root: a class-based target covers every SHACL
 * instance of the class, subclasses included ([SHACL] §2.1.3.2), so a node
 * reached as class C is also constrained by the shapes that target C's
 * ancestors. When `ancestorsOf` is given, those ancestors are reached too,
 * through `inherited` links that add no hop.
 *
 * Two phases keep inheritance from re-routing anything:
 *
 *  1. A breadth-first walk over predicates only, exactly as without
 *     `ancestorsOf`. Every class it reaches keeps this link, so existing
 *     paths — and the SPARQL compiled from them — do not change.
 *  2. A 0-1 BFS over the remaining classes: an ancestor link costs 0 hops,
 *     a predicate edge 1, and phase-1 classes are never relabelled. Each
 *     newly reached class gets its shortest path in hops; ties go to the
 *     first reached (phase-1 order, then ancestors sorted, then the sorted
 *     edge order), so the result is deterministic.
 */

export function bfsFromRoots(
  roots: Iterable<string>,
  forwardEdges: Map<string, { predicate: string; child: string }[]>,
  ancestorsOf?: (cls: string) => Set<string>
): Map<string, PredecessorLink> {
  const visited = new Map<string, PredecessorLink>()
  const depth = new Map<string, number>()
  const order: string[] = []
  // Each root has no predecessor; mark it visited with a sentinel so the
  // BFS doesn't loop back. A leaf owned by any root yields a direct path.
  for (const root of roots) {
    if (visited.has(root)) continue
    visited.set(root, { parent: '', predicate: '' })
    depth.set(root, 0)
    order.push(root)
  }
  for (let head = 0; head < order.length; head++) {
    const current = order[head]!
    for (const { predicate, child } of forwardEdges.get(current) ?? []) {
      if (visited.has(child)) continue
      visited.set(child, { parent: current, predicate })
      depth.set(child, depth.get(current)! + 1)
      order.push(child)
    }
  }
  if (ancestorsOf) inheritBelowRoots(order, visited, depth, forwardEdges, ancestorsOf)
  return visited
}

/**
 * Phase 2 of {@link bfsFromRoots}: extend `visited` with the classes reached
 * through `rdfs:subClassOf` ancestors, without relabelling a phase-1 class.
 * `phaseOne` is in breadth-first (non-decreasing depth) order, which is the
 * order a 0-1 BFS deque needs to start from.
 */
function inheritBelowRoots(
  phaseOne: string[],
  visited: Map<string, PredecessorLink>,
  depth: Map<string, number>,
  forwardEdges: Map<string, { predicate: string; child: string }[]>,
  ancestorsOf: (cls: string) => Set<string>
): void {
  const settled = new Set(phaseOne)
  const deque = [...phaseOne]
  const done = new Set<string>()
  const improves = (cls: string, d: number) =>
    !settled.has(cls) && (!depth.has(cls) || d < depth.get(cls)!)
  while (deque.length > 0) {
    const current = deque.shift()!
    if (done.has(current)) continue
    done.add(current)
    const d = depth.get(current)!
    for (const ancestor of [...ancestorsOf(current)].sort()) {
      if (ancestor === current || !improves(ancestor, d)) continue
      visited.set(ancestor, {
        parent: current,
        predicate: '',
        inherited: true,
        viaInheritance: true,
      })
      depth.set(ancestor, d)
      deque.unshift(ancestor)
    }
    // A phase-1 class's predicate edges were all walked in phase 1.
    if (settled.has(current)) continue
    for (const { predicate, child } of forwardEdges.get(current) ?? []) {
      if (!improves(child, d + 1)) continue
      visited.set(child, { parent: current, predicate, viaInheritance: true })
      depth.set(child, d + 1)
      deque.push(child)
    }
  }
}

/** The routes {@link routesFromRoots} found, and the classes it capped. */
export interface ClassRoutes {
  /**
   * Class → its routes, each the hops from a root to the class (every step
   * carries the class it reaches). The breadth-first route comes first.
   */
  routes: Map<string, PathStep[][]>
  /** Classes reached by more routes than the cap kept, sorted. */
  truncated: string[]
}

/**
 * Every route by which predicates alone reach each class from `roots`, not
 * only the one {@link bfsFromRoots} keeps. A class used in several contexts
 * (one behaviour class under the ego and under every other road user, say)
 * is reached through a different chain of property shapes in each
 * ([SHACL] §2.3): a different sequence path from the root
 * ([SHACL] §2.3.1.2), so each route is searchable on its own.
 *
 * A breadth-first walk over routes instead of classes: a class is entered
 * once per route that reaches it, and a route never enters a class it has
 * already passed, so cycles end. Within one hop count the breadth-first
 * route comes first, so the first route of every class is the one
 * {@link bfsFromRoots} picks; the others follow in IRI order. Edge order
 * decides only the breadth-first route (as it always has), and through it
 * which of two routes with the same local names is kept.
 *
 * Two routes whose predicates have the same local names count once. Slot
 * keys are built from those names (ADR 0009), so the second could only be
 * told apart by an ordinal; a shape that re-declares a superclass shape's
 * property in its own namespace produces exactly such a pair.
 *
 * At most `maxRoutes` routes are kept per class. A route that is not kept is
 * not continued, so the cap also bounds every class below it, and the number
 * of routes grows with the number of classes instead of multiplying along
 * every chain of reused classes.
 *
 * `breadthFirst` is the result of {@link bfsFromRoots} for the same roots
 * and edges, when the caller has it already; its predicate links are the
 * same with or without inheritance.
 */
export function routesFromRoots(
  roots: Iterable<string>,
  forwardEdges: Map<string, { predicate: string; child: string }[]>,
  maxRoutes: number,
  breadthFirst?: Map<string, PredecessorLink>
): ClassRoutes {
  const rootSet = new Set(roots)
  const firstRoute = breadthFirst ?? bfsFromRoots(rootSet, forwardEdges)
  const routes = new Map<string, PathStep[][]>()
  const names = new Map<string, Set<string>>()
  const truncated = new Set<string>()

  interface Route {
    cls: string
    steps: PathStep[]
    passed: Set<string>
    first: boolean
  }
  let layer: Route[] = [...rootSet].map((cls) => ({ cls, steps: [], passed: rootSet, first: true }))
  while (layer.length > 0) {
    const candidates = new Map<string, Route[]>()
    for (const route of layer) {
      for (const { predicate, child } of forwardEdges.get(route.cls) ?? []) {
        if (route.passed.has(child)) continue
        const link = firstRoute.get(child)
        const list = candidates.get(child) ?? []
        list.push({
          cls: child,
          steps: [...route.steps, { predicate, intermediate: child }],
          passed: new Set(route.passed).add(child),
          first: route.first && link?.parent === route.cls && link.predicate === predicate,
        })
        candidates.set(child, list)
      }
    }
    const next: Route[] = []
    for (const [cls, list] of candidates) {
      const kept = routes.get(cls) ?? []
      const seen = names.get(cls) ?? new Set<string>()
      for (const route of list.sort(byFirstThenIri)) {
        const chain = route.steps.map((step) => extractLocalName(step.predicate)).join(' ')
        if (seen.has(chain)) continue
        if (kept.length >= maxRoutes) {
          truncated.add(cls)
          break
        }
        seen.add(chain)
        kept.push(route.steps)
        next.push(route)
      }
      routes.set(cls, kept)
      names.set(cls, seen)
    }
    layer = next
  }
  return { routes, truncated: [...truncated].sort() }
}

const routeIris = (route: { steps: PathStep[] }): string =>
  route.steps.map((step) => `${step.predicate} ${step.intermediate ?? ''}`).join(' ')

function byFirstThenIri(
  a: { steps: PathStep[]; first: boolean },
  b: { steps: PathStep[]; first: boolean }
): number {
  return Number(b.first) - Number(a.first) || routeIris(a).localeCompare(routeIris(b))
}

/**
 * True when `target` is reached as an `rdfs:subClassOf` ancestor of the class
 * the last hop lands on, i.e. a leaf owned by `target` is inherited there.
 */
export function reachedAsAncestor(
  target: string,
  predecessors: Map<string, PredecessorLink>
): boolean {
  return predecessors.get(target)?.inherited === true
}

/** True when the walk from a root to `target` crosses an `inherited` link. */
export function reachedByInheritance(
  target: string,
  predecessors: Map<string, PredecessorLink>
): boolean {
  return predecessors.get(target)?.viaInheritance === true
}

export function pathStepsTo(
  target: string,
  predecessors: Map<string, PredecessorLink>,
  leafPredicate: string
): PathStep[] | null {
  // Walk back from `target` to the asset, collecting (predicate, parent)
  // pairs. If `target` is the asset itself the path has zero
  // intermediate hops and just the leaf step.
  if (!predecessors.has(target)) return null
  const intermediates: PathStep[] = []
  let cursor = target
  while (true) {
    const link = predecessors.get(cursor)
    // Reached the root: link.parent === '' (the sentinel).
    if (!link || link.parent === '') break
    // An inherited link is an is-a, not a hop: the step that reached
    // `link.parent` already lands on this node.
    if (!link.inherited) intermediates.unshift({ predicate: link.predicate, intermediate: cursor })
    cursor = link.parent
  }
  intermediates.push({ predicate: leafPredicate })
  return intermediates
}

/**
 * Discover the predicate chain from every asset class to every leaf
 * property declared in the schema graph.
 *
 * Uses a single SPARQL query (`queryResolvedEdges`) to get the fully
 * resolved class-to-class edge graph, then BFS from each asset class
 * to reconstruct predicate paths. BFS is needed because SPARQL 1.1
 * property paths (`*`, `+`) can test reachability but cannot bind
 * intermediate predicates along the way.
 *
 * The shortest route to each class comes from BFS — among predicate-only
 * routes first (see {@link bfsFromRoots} for how routes that need
 * inheritance are chosen). A class predicates reach by several routes gets
 * the others too ({@link routesFromRoots}): distinct by the local names of
 * their predicates, at most a fixed number per class.
 */

/** A top-level class of a non-asset vocabulary that instance data may use standalone. */
export interface VocabularyRoot {
  domain: string
  rootClass: string
}

/**
 * Discover the entry classes of the NON-asset vocabularies — the shapes a
 * standalone document of that vocabulary would be typed with (e.g. a
 * label/tag document published on its own, not nested inside any asset).
 *
 * A class qualifies when, purely from the shapes graph:
 *   - it owns a composition edge or a leaf property ([SHACL] §2.3 property
 *     shapes of a shape whose `sh:targetClass` is the class), and
 *   - its registry domain is a known vocabulary that is NOT an asset domain,
 *   - it is not an ancestor of an asset class (those are reached through the
 *     asset already), and
 *   - neither it nor any superclass is the value class of a composition edge
 *     (`sh:node` [SHACL] §4.7.1 / `sh:class` §4.1.1 nesting) — a nested class is
 *     part of something else, not an entry point.
 *
 * Nothing names a concrete ontology: the asset/vocabulary split comes from
 * the discovered asset domains and the registry. Sorted for determinism.
 */
export function findVocabularyRoots(input: {
  edges: { parentClass: string; childClass: string }[]
  leafOwners: Iterable<string>
  assetClasses: string[]
  assetDomains: Set<string>
  ancestorsOf: (cls: string) => Set<string>
  domainOf: (iri: string) => string | undefined
}): VocabularyRoot[] {
  const { edges, leafOwners, assetClasses, assetDomains, ancestorsOf, domainOf } = input
  const nested = new Set<string>()
  const owners = new Set<string>(leafOwners)
  for (const { parentClass, childClass } of edges) {
    if (parentClass === childClass) continue
    nested.add(childClass)
    owners.add(parentClass)
  }
  const assetAncestors = new Set<string>()
  for (const assetClass of assetClasses) {
    for (const ancestor of ancestorsOf(assetClass)) assetAncestors.add(ancestor)
  }
  const roots: VocabularyRoot[] = []
  for (const cls of owners) {
    const domain = domainOf(cls)
    if (!domain || assetDomains.has(domain) || assetAncestors.has(cls)) continue
    if ([...ancestorsOf(cls)].some((ancestor) => nested.has(ancestor))) continue
    roots.push({ domain, rootClass: cls })
  }
  return roots.sort(
    (a, b) => a.domain.localeCompare(b.domain) || a.rootClass.localeCompare(b.rootClass)
  )
}
