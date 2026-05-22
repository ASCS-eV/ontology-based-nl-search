/**
 * Property-path discovery from SHACL shapes.
 *
 * For every leaf property declared in the schema graph, computes the
 * chain of predicates that connects the property to its owning asset
 * class. This is the data the compiler needs to emit triples without
 * hard-coding any ENVITED-X meta-model predicates
 * (`hasDomainSpecification`, `hasContent`, …).
 *
 * Example, with the workspace ontology:
 *
 *     hdmap:HdMap
 *       --hdmap:hasDomainSpecification--> hdmap:DomainSpecification
 *       --hdmap:hasContent--> hdmap:Content
 *       --hdmap:roadTypes--> "motorway" (leaf value)
 *
 * `buildPropertyPaths()` returns one `PropertyPath` per
 * (asset-class, leaf-property) pair, with `steps` listing the
 * predicates in walk order including the leaf predicate.
 *
 * This module is purely additive in 21a — task 21b will rewire the
 * compiler to consume the paths instead of emitting literal
 * meta-model predicates.
 *
 * @see https://www.w3.org/TR/shacl/#NodeShape — SHACL NodeShape
 * @see https://www.w3.org/TR/shacl/#PropertyShape — SHACL PropertyShape
 */
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'
import { queryAssetDomains } from './schema-queries.js'

/** One predicate hop on a property path. */
export interface PathStep {
  /** Full IRI of the predicate to walk. */
  predicate: string
  /**
   * Target-class IRI of the resource reached by this hop, if any.
   * Leaf steps (the last hop on the path) leave this undefined —
   * the leaf yields a literal value, not a typed sub-resource.
   */
  intermediate?: string
}

/**
 * A discovered path from an asset class to one of its leaf properties.
 * Independent of the ENVITED-X meta-model: every literal predicate
 * comes from `sh:path` declarations in the schema graph.
 */
export interface PropertyPath {
  /** Domain of the leaf property (`hdmap`, `scenario`, …). */
  domain: string
  /** Local name of the leaf property (`roadTypes`, `formatType`, …). */
  propertyName: string
  /** Full IRI of the leaf property. */
  propertyIri: string
  /** Asset class IRI at the root of the path. */
  assetClass: string
  /**
   * Predicates to walk, in order, from the asset variable to the
   * leaf property value. The final step's predicate is the leaf
   * property itself.
   */
  steps: PathStep[]
}

/** Local-name extraction (after last `/` or `#`). */
function extractLocalName(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/** Extract the domain name for an IRI using registry or path convention. */
function extractDomain(iri: string, registry?: DomainRegistry): string {
  if (registry) {
    return registry.domainForIri(iri) ?? ''
  }
  const match = iri.match(new RegExp('/([^/]+)/v\\d+/'))
  return match?.[1] ?? ''
}

/** Resolved edge: parent class → predicate → child class (target classes, not shapes). */
interface ResolvedEdge {
  parentClass: string
  predicate: string
  childClass: string
}

/**
 * Query shape-to-shape edges and resolve them to
 * (parentClass, predicate, childClass) triples.
 *
 * Uses two queries without rdf:rest star property paths (Oxigraph WASM
 * crashes with RuntimeError on UNION + property-path-star even in 0.5.x).
 * Instead, sh:or lists are traversed by querying direct rdf:first/rdf:rest
 * links to a bounded depth (RDF lists in SHACL shapes are short).
 */
async function queryResolvedEdges(store: SparqlStore): Promise<ResolvedEdge[]> {
  // Step 1: Get edges from parentClass → predicate → childShape
  // Handles both direct sh:node and sh:or disjunction (bounded list depth)
  const edgeSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?parentClass ?predicate ?childShape WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        FILTER(isIRI(?predicate))

        {
          ?propShape sh:node ?childShape .
        } UNION {
          ?propShape sh:or ?list .
          ?list rdf:first ?item .
          ?item sh:node ?childShape .
        } UNION {
          ?propShape sh:or ?list .
          ?list rdf:rest ?r1 .
          ?r1 rdf:first ?item .
          ?item sh:node ?childShape .
        } UNION {
          ?propShape sh:or ?list .
          ?list rdf:rest ?r1 . ?r1 rdf:rest ?r2 .
          ?r2 rdf:first ?item .
          ?item sh:node ?childShape .
        } UNION {
          ?propShape sh:or ?list .
          ?list rdf:rest ?r1 . ?r1 rdf:rest ?r2 . ?r2 rdf:rest ?r3 .
          ?r3 rdf:first ?item .
          ?item sh:node ?childShape .
        }
      }
    }
  `

  // Step 2: Resolve shapes to their target classes (same bounded-depth pattern)
  const targetSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?shape ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        {
          ?shape sh:targetClass ?targetClass .
        } UNION {
          ?shape sh:or ?list .
          ?list rdf:first ?item .
          ?item sh:node ?inner .
          ?inner sh:targetClass ?targetClass .
        } UNION {
          ?shape sh:or ?list .
          ?list rdf:rest ?r1 .
          ?r1 rdf:first ?item .
          ?item sh:node ?inner .
          ?inner sh:targetClass ?targetClass .
        } UNION {
          ?shape sh:or ?list .
          ?list rdf:rest ?r1 . ?r1 rdf:rest ?r2 .
          ?r2 rdf:first ?item .
          ?item sh:node ?inner .
          ?inner sh:targetClass ?targetClass .
        } UNION {
          ?shape sh:or ?list .
          ?list rdf:rest ?r1 . ?r1 rdf:rest ?r2 . ?r2 rdf:rest ?r3 .
          ?r3 rdf:first ?item .
          ?item sh:node ?inner .
          ?inner sh:targetClass ?targetClass .
        }
        FILTER(isIRI(?targetClass))
      }
    }
  `

  const [edgeResult, targetResult] = await Promise.all([
    store.query(edgeSparql),
    store.query(targetSparql),
  ])

  // Build shape → targetClass[] lookup
  const shapeTargets = new Map<string, string[]>()
  for (const row of targetResult.results.bindings) {
    const shape = row['shape']?.value
    const targetClass = row['targetClass']?.value
    if (!shape || !targetClass) continue
    const list = shapeTargets.get(shape) ?? []
    list.push(targetClass)
    shapeTargets.set(shape, list)
  }

  // Resolve edges
  const edges: ResolvedEdge[] = []
  const seen = new Set<string>()
  for (const row of edgeResult.results.bindings) {
    const parentClass = row['parentClass']?.value
    const predicate = row['predicate']?.value
    const childShape = row['childShape']?.value
    if (!parentClass || !predicate || !childShape) continue

    const targets = shapeTargets.get(childShape) ?? []
    for (const childClass of targets) {
      const key = `${parentClass}|${predicate}|${childClass}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ parentClass, predicate, childClass })
    }
  }
  return edges
}

/**
 * Query every `(targetClass, leaf-predicate, leaf-iri)` triple — the
 * leaves of every property path. A leaf is a property shape with a
 * literal `sh:path` and NO `sh:node` (its values are RDF literals,
 * not sub-resources).
 */
async function queryLeafProperties(
  store: SparqlStore
): Promise<{ owningClass: string; propertyIri: string }[]> {
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?owningClass ?propertyIri WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?owningShape sh:targetClass ?owningClass .
        ?owningShape sh:property ?propShape .
        ?propShape sh:path ?propertyIri .
        FILTER(isIRI(?propertyIri))
        FILTER NOT EXISTS { ?propShape sh:node ?anyNode }
        FILTER NOT EXISTS { ?propShape sh:or ?anyOr }
      }
    }
  `

  const result = await store.query(sparql)
  const leaves: { owningClass: string; propertyIri: string }[] = []
  for (const row of result.results.bindings) {
    const owningClass = row['owningClass']?.value
    const propertyIri = row['propertyIri']?.value
    if (owningClass && propertyIri) {
      leaves.push({ owningClass, propertyIri })
    }
  }
  return leaves
}

interface PredecessorLink {
  parent: string
  predicate: string
}

/**
 * BFS from `assetClass` through the edge graph; return predecessor
 * links keyed by reached target class. Used to reconstruct a path
 * by walking predecessors in reverse from a leaf's owning class.
 */
function bfsFromAsset(
  assetClass: string,
  forwardEdges: Map<string, { predicate: string; child: string }[]>
): Map<string, PredecessorLink> {
  const visited = new Map<string, PredecessorLink>()
  // The asset itself has no predecessor; mark it visited with a
  // sentinel so the BFS doesn't loop back.
  visited.set(assetClass, { parent: '', predicate: '' })
  const queue: string[] = [assetClass]
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

function pathStepsTo(
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
export async function buildPropertyPaths(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<PropertyPath[]> {
  const [resolvedEdges, leaves, assetDomainRows] = await Promise.all([
    queryResolvedEdges(store),
    queryLeafProperties(store),
    queryAssetDomains(store, registry),
  ])
  const assetClasses = assetDomainRows.map((row) => row.assetClass)

  // Build the forward edge graph directly from resolved edges
  const forwardEdges = new Map<string, { predicate: string; child: string }[]>()
  for (const { parentClass, predicate, childClass } of resolvedEdges) {
    if (childClass === parentClass) continue // skip self-loops
    const list = forwardEdges.get(parentClass) ?? []
    list.push({ predicate, child: childClass })
    forwardEdges.set(parentClass, list)
  }

  // For each asset class, walk forward and emit one PropertyPath per leaf
  // whose owning class is reachable.
  const out: PropertyPath[] = []
  for (const assetClass of assetClasses) {
    const predecessors = bfsFromAsset(assetClass, forwardEdges)
    for (const { owningClass, propertyIri } of leaves) {
      const steps = pathStepsTo(owningClass, predecessors, propertyIri)
      if (!steps) continue
      out.push({
        domain: extractDomain(assetClass, registry),
        propertyName: extractLocalName(propertyIri),
        propertyIri,
        assetClass,
        steps,
      })
    }
  }
  return out
}
