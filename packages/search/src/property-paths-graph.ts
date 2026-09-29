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
 * ancestors. When `ancestorsOf` is given, each class the walk reaches
 * brings its unvisited ancestors along as `inherited` links (no hop).
 *
 * Inheritance only ever adds classes; it never re-routes one. The walk
 * runs in rounds: the first follows predicates exactly as a walk without
 * `ancestorsOf` would, and each later round first adds the unvisited
 * ancestors of every class reached so far (in reach order, ancestors
 * sorted), then follows predicates from them. A class reachable through
 * predicates alone therefore keeps the path it has without inheritance,
 * and existing paths — and the SPARQL compiled from them — do not change.
 */

export function bfsFromRoots(
  roots: Iterable<string>,
  forwardEdges: Map<string, { predicate: string; child: string }[]>,
  ancestorsOf?: (cls: string) => Set<string>
): Map<string, PredecessorLink> {
  const visited = new Map<string, PredecessorLink>()
  let queue: string[] = []
  // Each root has no predecessor; mark it visited with a sentinel so the
  // BFS doesn't loop back. A leaf owned by any root yields a direct path.
  for (const root of roots) {
    if (visited.has(root)) continue
    visited.set(root, { parent: '', predicate: '' })
    queue.push(root)
  }
  while (queue.length > 0) {
    walkPredicates(queue, forwardEdges, visited)
    if (!ancestorsOf) break
    queue = []
    for (const reached of [...visited.keys()]) {
      for (const ancestor of [...ancestorsOf(reached)].sort()) {
        if (visited.has(ancestor)) continue
        visited.set(ancestor, { parent: reached, predicate: '', inherited: true })
        queue.push(ancestor)
      }
    }
  }
  return visited
}

/** Breadth-first over predicate edges from `queue`, recording first reaches. */
function walkPredicates(
  queue: string[],
  forwardEdges: Map<string, { predicate: string; child: string }[]>,
  visited: Map<string, PredecessorLink>
): void {
  while (queue.length > 0) {
    const current = queue.shift()!
    const edges = forwardEdges.get(current) ?? []
    for (const { predicate, child } of edges) {
      if (visited.has(child)) continue
      visited.set(child, { parent: current, predicate })
      queue.push(child)
    }
  }
}

/** True when the walk back from `target` to a root crosses an `inherited` link. */
export function reachedByInheritance(
  target: string,
  predecessors: Map<string, PredecessorLink>
): boolean {
  let link = predecessors.get(target)
  while (link && link.parent !== '') {
    if (link.inherited) return true
    link = predecessors.get(link.parent)
  }
  return false
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
 * multiple parallel paths, only the shortest is emitted.
 */
