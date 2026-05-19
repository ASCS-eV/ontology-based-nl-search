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

/** Raw `(parentClass, predicate, childShape)` edge from the schema. */
interface RawEdge {
  parentClass: string
  predicate: string
  childShape: string
}

/** Local-name extraction (after last `/` or `#`). */
function extractLocalName(iri: string): string {
  const idx = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'))
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/** Extract the ENVITED-X-style domain segment from an IRI. */
function extractDomain(iri: string): string {
  const match = iri.match(/\/([^/]+)\/v\d+\//)
  return match?.[1] ?? ''
}

/**
 * Query every shape-to-shape edge: each property shape that has a
 * `sh:node` target (directly OR via an `sh:or` disjunction list)
 * contributes one edge per child shape.
 *
 * The `sh:or` branch matters because the workspace ontology declares
 * union wrappers like `hdmap:ContentOrOddSceneryShape` — anonymous
 * shapes with no `sh:targetClass` of their own. The next query
 * (`queryShapeTargets`) resolves such wrappers down to a concrete
 * target class.
 *
 * **Implementation note**: run as two separate queries instead of one
 * `UNION`. Oxigraph WASM crashes (`RuntimeError: unreachable`) when a
 * SPARQL `UNION` is combined with a property-path `*` star in the
 * same query — the schema-queries module documents the same workaround
 * for cross-domain reference discovery.
 */
async function queryShapeEdges(store: SparqlStore): Promise<RawEdge[]> {
  const directSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?parentClass ?predicate ?childShape WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        ?propShape sh:node ?childShape .
        FILTER(isIRI(?predicate))
      }
    }
  `

  const orListSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?parentClass ?predicate ?childShape WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        ?propShape sh:or ?orList .
        ?orList rdf:rest*/rdf:first ?orItem .
        ?orItem sh:node ?childShape .
        FILTER(isIRI(?predicate))
      }
    }
  `

  const [direct, orList] = await Promise.all([store.query(directSparql), store.query(orListSparql)])
  const edges: RawEdge[] = []
  const seen = new Set<string>()
  for (const result of [direct, orList]) {
    for (const row of result.results.bindings) {
      const parentClass = row['parentClass']?.value
      const predicate = row['predicate']?.value
      const childShape = row['childShape']?.value
      if (!parentClass || !predicate || !childShape) continue
      const key = `${parentClass}|${predicate}|${childShape}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ parentClass, predicate, childShape })
    }
  }
  return edges
}

/**
 * Map every shape IRI to the set of target classes it represents.
 *
 * Concrete shapes contribute one entry (`shape → its sh:targetClass`).
 * Union wrappers (`shape sh:or (... [sh:node X] ...)`) collapse to
 * the target classes of their alternatives — so an edge that lands
 * on a wrapper can be resolved to the same set of leaf shapes the
 * wrapper would have validated against.
 */
async function queryShapeTargets(store: SparqlStore): Promise<Map<string, string[]>> {
  // Same Oxigraph-WASM UNION+`*` crash workaround as queryShapeEdges:
  // run direct and `sh:or`-list cases as separate queries.
  const directSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?shape ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?targetClass .
        FILTER(isIRI(?targetClass))
      }
    }
  `

  const orListSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?shape ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:or ?orList .
        ?orList rdf:rest*/rdf:first ?orItem .
        ?orItem sh:node ?nested .
        ?nested sh:targetClass ?targetClass .
        FILTER(isIRI(?targetClass))
      }
    }
  `

  const [direct, orList] = await Promise.all([store.query(directSparql), store.query(orListSparql)])
  const out = new Map<string, string[]>()
  for (const result of [direct, orList]) {
    for (const row of result.results.bindings) {
      const shape = row['shape']?.value
      const targetClass = row['targetClass']?.value
      if (!shape || !targetClass) continue
      const existing = out.get(shape) ?? []
      if (!existing.includes(targetClass)) {
        existing.push(targetClass)
        out.set(shape, existing)
      }
    }
  }
  return out
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
 * Assumes the schema has already been loaded into the configured
 * SCHEMA_GRAPH (the api app's warmup phase does this).
 *
 * Limitations of this initial (21a) version:
 *   - Resolves `sh:or` disjunctions one level deep; deeper nesting
 *     would need a recursive walk.
 *   - Picks one path per (asset, leaf) pair via BFS; if the schema
 *     has multiple parallel paths, only the shortest is emitted.
 *   - Does not yet handle `sh:and` conjunctions or `sh:property`
 *     inheritance.
 */
export async function buildPropertyPaths(store: SparqlStore): Promise<PropertyPath[]> {
  const [edges, shapeTargets, leaves, assetDomainRows] = await Promise.all([
    queryShapeEdges(store),
    queryShapeTargets(store),
    queryLeafProperties(store),
    queryAssetDomains(store),
  ])
  const assetClasses = assetDomainRows.map((row) => row.assetClass)

  // Build the forward edge graph: parentClass → [(predicate, childClass), ...]
  // Each raw edge points at a shape; the shape may resolve to multiple
  // target classes (union wrappers). One forward edge per resolved class.
  const forwardEdges = new Map<string, { predicate: string; child: string }[]>()
  for (const { parentClass, predicate, childShape } of edges) {
    const childClasses = shapeTargets.get(childShape) ?? []
    for (const child of childClasses) {
      if (child === parentClass) continue // skip self-loops
      const list = forwardEdges.get(parentClass) ?? []
      list.push({ predicate, child })
      forwardEdges.set(parentClass, list)
    }
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
        domain: extractDomain(assetClass),
        propertyName: extractLocalName(propertyIri),
        propertyIri,
        assetClass,
        steps,
      })
    }
  }
  return out
}
