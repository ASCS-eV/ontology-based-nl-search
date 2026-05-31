/**
 * Data-driven reference index.
 *
 * Scans the instance graph at startup; for every (sourceClass,
 * predicatePath, targetClass) signature where a typed asset instance
 * reaches another typed asset instance through any predicate path
 * (including blank-node hops common in JSON-LD manifests), records the
 * path and a sample count.
 *
 * This is the data-driven counterpart to `buildReferenceChains` (which
 * walks SHACL leaf properties): SHACL says what *can* be linked; the
 * instance graph says what *is* linked. The two answers can diverge —
 * a SHACL chain may declare a relationship that no data uses, and a
 * data chain may exist that SHACL declares only transitively via a
 * shared shape (e.g. `manifest:ManifestShape`) the BFS over property
 * paths doesn't surface as a typed leaf.
 *
 * Used by the SPARQL compiler to emit precise JOIN patterns when
 * `slots.references` is set, and by the traceability layer (WP3) to
 * expose the actual chain to the user.
 *
 * Ontology-agnostic: discovers the link graph empirically from typed
 * instance data without reading any ontology-specific predicate name.
 * The only concept it depends on is "a node is typed" — `?s rdf:type
 * ?T` — which is universal RDF.
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { iri } from '@ontology-search/core/rdf/prefixes'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'

import { getAssetDomains } from './asset-domains.js'
import { getInitializedStore } from './init.js'

const log = createComponentLogger('reference-index')

/**
 * Maximum predicate hops to traverse from a typed source before
 * stopping. Generous bound: the deepest reference chains observed in
 * practice (the JSON-LD `manifest:Link` indirection) reach 4 hops
 * (`hasManifest → hasReferencedArtifacts → Link → iri`). 6 leaves
 * headroom for future ontologies without making the BFS combinatorial.
 */
const MAX_DEPTH = 6

/** RDF type predicate IRI — excluded from path-step recording. */
const RDF_TYPE = iri('rdf', 'type')

/**
 * One discovered link between two typed asset instances, generalised
 * to a class-level signature with a sample-count.
 */
export interface DataReferenceEdge {
  /** Source asset class IRI (e.g. ".../ositrace/v6/OSITrace"). */
  sourceClass: string
  /** Source domain name (e.g. "ositrace"). */
  sourceDomain: string
  /** Target asset class IRI. */
  targetClass: string
  /** Target domain name. */
  targetDomain: string
  /**
   * Ordered predicate IRIs along the path. A direct edge has one
   * entry; the JSON-LD manifest pattern is typically four entries.
   */
  predicatePath: string[]
  /**
   * Number of distinct (source-instance, target-instance) pairs
   * observed in the data that match this signature. ≥1.
   */
  sampleCount: number
}

/**
 * Discovered link graph: source-domain name → list of edges that
 * originate from any asset class in that domain.
 *
 * Keyed by source-domain (not source-class IRI) so it composes with
 * `pickReferenceChain` and `slots.references.domain` without an extra
 * lookup.
 */
export type ReferenceIndex = ReadonlyMap<string, DataReferenceEdge[]>

let cachedIndexPromise: Promise<ReferenceIndex> | null = null

/** Reset the cached singleton (for tests / hot reload). */
export function resetReferenceIndex(): void {
  cachedIndexPromise = null
}

/** Get the singleton reference index, building it on first call. */
export async function getReferenceIndex(): Promise<ReferenceIndex> {
  if (!cachedIndexPromise) cachedIndexPromise = buildReferenceIndex()
  return cachedIndexPromise
}

/** Strongly-typed adjacency: subject IRI → outgoing edges. */
type Adjacency = Map<string, { predicate: string; object: string }[]>

/** Subject IRI → set of RDF types declared on it. */
type TypeMap = Map<string, Set<string>>

/**
 * Build the index from scratch. Two SPARQL queries pull the data
 * graph's type triples and adjacency triples; everything else is
 * an in-memory BFS. The queries deliberately do NOT use `GRAPH` —
 * the default graph is data-only (schema lives in a named graph),
 * so plain `?s ?p ?o` is the right scope.
 */
async function buildReferenceIndex(): Promise<ReferenceIndex> {
  const end = log.time('build')
  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()
  const assetDomains = await getAssetDomains()

  // Map asset class IRI → { domainName }. Only classes whose owning
  // domain is in the discovered asset-domain set count as endpoints —
  // matches the gate `resolveKnownDomains` already applies.
  const assetClassByIri = new Map<string, { domain: string }>()
  for (const [domainName, desc] of registry.domains) {
    if (!assetDomains.has(domainName)) continue
    assetClassByIri.set(desc.targetClassIri, { domain: domainName })
  }

  if (assetClassByIri.size === 0) {
    log.warn('No asset classes registered; reference index is empty')
    end()
    return new Map()
  }

  const [typeMap, adjacency] = await Promise.all([loadTypeMap(store), loadAdjacency(store)])

  // Aggregate by (sourceClass, predicatePath, targetClass) signature so
  // multiple instance pairs that follow the same shape collapse into a
  // single edge with a count.
  const bySignature = new Map<string, DataReferenceEdge>()

  for (const [subject, types] of typeMap) {
    const sourceClasses = [...types].filter((t) => assetClassByIri.has(t))
    if (sourceClasses.length === 0) continue
    bfsFromSource(subject, sourceClasses, adjacency, typeMap, assetClassByIri, bySignature)
  }

  // Group by source-domain so the compiler can iterate edges for a
  // given parent domain in one lookup.
  const byDomain = new Map<string, DataReferenceEdge[]>()
  for (const edge of bySignature.values()) {
    const existing = byDomain.get(edge.sourceDomain)
    if (existing) existing.push(edge)
    else byDomain.set(edge.sourceDomain, [edge])
  }

  end()
  log.info('Reference index built', {
    edgeSignatures: bySignature.size,
    sourceDomains: byDomain.size,
  })
  return byDomain
}

/**
 * BFS from one typed-asset subject through the data graph. Each typed
 * asset node encountered (other than the source itself) yields one
 * signature entry; the traversal continues past such nodes so chained
 * paths (A → B → C) are discovered too — needed by the N-hop work in
 * task #19.
 */
function bfsFromSource(
  sourceIri: string,
  sourceClasses: string[],
  adjacency: Adjacency,
  typeMap: TypeMap,
  assetClassByIri: Map<string, { domain: string }>,
  out: Map<string, DataReferenceEdge>
): void {
  interface Frontier {
    node: string
    path: string[]
  }
  const initial = adjacency.get(sourceIri) ?? []
  const queue: Frontier[] = initial.map((edge) => ({
    node: edge.object,
    path: [edge.predicate],
  }))
  // Guard against pathological cycles by tracking (node, path-length)
  // pairs we've already enqueued; the same node can be reached via
  // multiple paths at different depths and each is interesting.
  const seenAtDepth = new Set<string>()

  while (queue.length > 0) {
    const frontier = queue.shift()!
    const key = `${frontier.node}@${frontier.path.length}`
    if (seenAtDepth.has(key)) continue
    seenAtDepth.add(key)

    // If this node is a typed asset (and not the source itself), record
    // an edge for every (source-class, this-class) pair.
    if (frontier.node !== sourceIri) {
      const targetClasses = [...(typeMap.get(frontier.node) ?? [])].filter((t) =>
        assetClassByIri.has(t)
      )
      for (const targetClass of targetClasses) {
        const targetDomain = assetClassByIri.get(targetClass)!.domain
        for (const sourceClass of sourceClasses) {
          if (sourceClass === targetClass) continue
          const sourceDomain = assetClassByIri.get(sourceClass)!.domain
          const signature = `${sourceClass}|${frontier.path.join('')}|${targetClass}`
          const existing = out.get(signature)
          if (existing) {
            existing.sampleCount++
          } else {
            out.set(signature, {
              sourceClass,
              sourceDomain,
              targetClass,
              targetDomain,
              predicatePath: [...frontier.path],
              sampleCount: 1,
            })
          }
        }
      }
    }

    // Continue exploring past this node up to MAX_DEPTH.
    if (frontier.path.length >= MAX_DEPTH) continue
    const next = adjacency.get(frontier.node) ?? []
    for (const edge of next) {
      queue.push({ node: edge.object, path: [...frontier.path, edge.predicate] })
    }
  }
}

/**
 * Pull every `?s a ?t` triple from the data graph. The default graph
 * holds instance data (schema is in `<urn:graph:schema>`), so the
 * plain query is naturally scoped.
 */
async function loadTypeMap(
  store: import('@ontology-search/sparql/types').SparqlStore
): Promise<TypeMap> {
  const sparql = `SELECT ?s ?t WHERE { ?s a ?t }`
  const result = await store.query(sparql)
  const map: TypeMap = new Map()
  for (const row of result.results.bindings) {
    const s = row['s']?.value
    const t = row['t']?.value
    if (!s || !t) continue
    const existing = map.get(s)
    if (existing) existing.add(t)
    else map.set(s, new Set([t]))
  }
  return map
}

/**
 * Pull every `?s ?p ?o` triple where the object is an IRI or blank
 * node (literals can never be a path's intermediate node, so they're
 * filtered out at the SPARQL level to keep the result set small). The
 * `rdf:type` predicate is skipped — it's the source of the type map,
 * not a traversable reference predicate.
 */
async function loadAdjacency(
  store: import('@ontology-search/sparql/types').SparqlStore
): Promise<Adjacency> {
  const sparql = `
    SELECT ?s ?p ?o WHERE {
      ?s ?p ?o
      FILTER(?p != <${RDF_TYPE}>)
      FILTER(isIRI(?o) || isBlank(?o))
    }
  `
  const result = await store.query(sparql)
  const map: Adjacency = new Map()
  for (const row of result.results.bindings) {
    const s = row['s']?.value
    const p = row['p']?.value
    const o = row['o']?.value
    if (!s || !p || !o) continue
    const edges = map.get(s)
    if (edges) edges.push({ predicate: p, object: o })
    else map.set(s, [{ predicate: p, object: o }])
  }
  return map
}
