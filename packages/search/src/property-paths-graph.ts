/**
 * Property-path graph traversal (ADR 0003) — pure ancestor-closure + BFS over
 * the resolved SHACL edge graph, producing the predicate-hop path to each leaf.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
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
 * Picks one path per (asset, leaf) pair via BFS; if the schema has
 * multiple parallel paths, only the shortest is emitted — among
 * predicate-only paths first (see {@link bfsFromRoots} for how paths that
 * need inheritance are chosen).
 */
