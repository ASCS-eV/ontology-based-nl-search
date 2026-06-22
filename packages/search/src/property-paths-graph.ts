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
 */

export function bfsFromRoots(
  roots: Iterable<string>,
  forwardEdges: Map<string, { predicate: string; child: string }[]>
): Map<string, PredecessorLink> {
  const visited = new Map<string, PredecessorLink>()
  const queue: string[] = []
  // Each root has no predecessor; mark it visited with a sentinel so the
  // BFS doesn't loop back. A leaf owned by any root yields a direct path.
  for (const root of roots) {
    if (visited.has(root)) continue
    visited.set(root, { parent: '', predicate: '' })
    queue.push(root)
  }
  while (queue.length > 0) {
    const current = queue.shift()!
    const edges = forwardEdges.get(current) ?? []
    for (const { predicate, child } of edges) {
      if (visited.has(child)) continue
      visited.set(child, { parent: current, predicate })
      queue.push(child)
    }
  }
  return visited
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
    intermediates.unshift({ predicate: link.predicate, intermediate: cursor })
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
