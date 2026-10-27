/**
 * Property-path discovery — orchestrates SHACL edge/leaf queries + graph
 * traversal into the predicate-hop paths and cross-domain reference chains the
 * compiler reads. The SPARQL/IO layer lives in `./property-paths-queries.js`,
 * the pure graph traversal in `./property-paths-graph.js`, and the shared data
 * shapes in `./property-paths-types.js` (ADR 0003 split for CONTRIBUTING #15).
 * Public surface (the types + buildPropertyPaths + buildReferenceChains) is
 * unchanged.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { extractDomain, extractLocalName } from '@ontology-search/core/rdf/iri'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import {
  bfsFromRoots,
  buildAncestorClosure,
  findVocabularyRoots,
  pathStepsTo,
  type PredecessorLink,
  reachedAsAncestor,
  reachedByInheritance,
  routesFromRoots,
} from './property-paths-graph.js'
import {
  enrichLeafKinds,
  type LeafRow,
  queryLeafDatatypes,
  queryLeafEnumerations,
  queryLeafProperties,
  queryResolvedEdges,
} from './property-paths-queries.js'
import { type AssetDomainInfo, queryAssetDomains, querySubClassEdges } from './schema-queries.js'

export type { LeafKind, PathStep, PropertyPath, ReferenceChain } from './property-paths-types.js'
import type { PathStep, PropertyPath, ReferenceChain } from './property-paths-types.js'

const log = createComponentLogger('property-paths')

/** Extract the domain name for an IRI using registry or path convention. */
function extractDomainFromRegistry(iri: string, registry?: DomainRegistry): string {
  return extractDomain(iri, registry ? (i) => registry.domainForIri(i) : undefined)
}

export async function buildPropertyPaths(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<PropertyPath[]> {
  return (await discoverPropertyPaths(store, registry)).assetPaths
}

/** Both path families discovered from one pass over the shapes graph. */
export interface DiscoveredPropertyPaths {
  /** Paths rooted at an asset class (`domain` = the asset domain). */
  assetPaths: PropertyPath[]
  /**
   * Paths rooted at a standalone entry class of a non-asset vocabulary
   * (`domain` = that vocabulary, `assetClass` = the entry class). See
   * {@link findVocabularyRoots}. Kept apart from `assetPaths` so the asset
   * path index, reference chains and domain partitioning are unchanged.
   */
  vocabularyRootPaths: PropertyPath[]
}

/**
 * Emit one PropertyPath per leaf whose owning class is reachable, along the
 * breadth-first route only. Below a vocabulary's entry class, reused party
 * and address classes multiply the routes (one address class under every
 * party, once per kind of address), and the card budget is not sized for
 * that; {@link emitPaths} keeps the further routes below an asset class.
 */
function pathsFrom(
  rootClass: string,
  domain: string,
  predecessors: Map<string, PredecessorLink>,
  leaves: LeafRow[],
  out: PropertyPath[]
): void {
  for (const { owningClass, propertyIri, leafKind } of leaves) {
    const steps = pathStepsTo(owningClass, predecessors, propertyIri)
    if (!steps) continue
    out.push({
      domain,
      propertyName: extractLocalName(propertyIri),
      propertyIri,
      assetClass: rootClass,
      owningClass,
      steps,
      leafKind,
      ...(reachedAsAncestor(owningClass, predecessors) && { inheritedLeaf: true }),
    })
  }
}

/**
 * The most routes kept to one class ({@link routesFromRoots}). Each route
 * gives every leaf of the class a key and a term card of its own, and the
 * bare leaf name one more `UNION` branch: a class with k leaves reached by r
 * routes costs r·k cards. Four keeps the cards one leaf of one class adds
 * within a tenth of retrieval's default card budget per query
 * (`DEFAULT_MAX_CARDS`, 40). The bound is per class, not per leaf name: a
 * name several classes declare — the leaves of a value class that ends many
 * chains — has a card per chain before any route is counted, and each class
 * multiplies its own share by at most four. The pinned ontology's asset
 * classes need three.
 */
export const MAX_ROUTES_PER_CLASS = 4

/**
 * A path along each further route to its owning class, flagged
 * `alternateRoute`: a class used in several contexts is reached through a
 * different sequence path from the asset in each ([SHACL] §2.3.1.2). The
 * first route is the breadth-first one `path` was built from, so it is
 * skipped. A class reached only through inheritance has no predicate routes
 * and gets none.
 */
function alternateRoutesOf(path: PropertyPath, routes: Map<string, PathStep[][]>): PropertyPath[] {
  const further = (path.owningClass && routes.get(path.owningClass)?.slice(1)) || []
  return further.map((route) => ({
    ...path,
    steps: [...route, { predicate: path.propertyIri }],
    alternateRoute: true,
  }))
}

export async function discoverPropertyPaths(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<DiscoveredPropertyPaths> {
  // Each sub-step is logged with its own duration: this whole function
  // is the dominant cold-start cost (tens of seconds on a large schema
  // graph), and without per-phase timings the warmup is an opaque gap.
  const t0 = Date.now()
  const edgesEnd = log.time('property-paths/resolved-edges')
  const leavesEnd = log.time('property-paths/leaf-properties')
  const assetsEnd = log.time('property-paths/asset-domains')
  const subClassEnd = log.time('property-paths/subclass-edges')
  const [resolvedEdges, leaves, assetDomainRows, subClassEdges] = await Promise.all([
    queryResolvedEdges(store).then((r) => {
      edgesEnd()
      return r
    }),
    queryLeafProperties(store).then((r) => {
      leavesEnd()
      return r
    }),
    queryAssetDomains(store, registry).then((r) => {
      assetsEnd()
      return r
    }),
    querySubClassEdges(store).then((r) => {
      subClassEnd()
      return r
    }),
  ])
  const assetClasses = assetDomainRows.map((row) => row.assetClass)
  // An asset inherits the SHACL constraints of its superclasses (RDFS/SHACL
  // semantics), so each asset class's path search is seeded from itself plus
  // its transitive rdfs:subClassOf ancestors.
  const ancestorsOf = buildAncestorClosure(subClassEdges)
  log.debug('Property-path inputs discovered', {
    edges: resolvedEdges.length,
    leaves: leaves.length,
    assetClasses: assetClasses.length,
  })

  // Build the forward edge graph directly from resolved edges
  const forwardEdges = new Map<string, { predicate: string; child: string }[]>()
  for (const { parentClass, predicate, childClass } of resolvedEdges) {
    if (childClass === parentClass) continue // skip self-loops
    const list = forwardEdges.get(parentClass) ?? []
    list.push({ predicate, child: childClass })
    forwardEdges.set(parentClass, list)
  }

  // For each asset class, walk forward and emit a PropertyPath per route to
  // each leaf whose owning class is reachable.
  const bfsEnd = log.time('property-paths/bfs')
  const out = emitPaths(assetDomainRows, leaves, forwardEdges, ancestorsOf)

  // Standalone vocabulary entry classes get the same traversal, so a document
  // typed only with a support vocabulary's top-level class is searchable too.
  // Requires the registry: without it there is no asset/vocabulary split.
  const rootPaths: PropertyPath[] = []
  if (registry) {
    const roots = findVocabularyRoots({
      edges: resolvedEdges,
      leafOwners: leaves.map((leaf) => leaf.owningClass),
      assetClasses,
      assetDomains: new Set(assetDomainRows.map((row) => row.domainName)),
      ancestorsOf,
      domainOf: (iri) => registry.domainForIri(iri),
    })
    for (const { domain, rootClass } of roots) {
      const predecessors = bfsFromRoots(ancestorsOf(rootClass), forwardEdges, ancestorsOf)
      pathsFrom(rootClass, domain, predecessors, leaves, rootPaths)
    }
  }
  bfsEnd()

  // Second pass: enrich leafKind from the schema graph for the leaves
  // that actually showed up in a discovered path. Done after BFS so the
  // hot leaf query stays minimal (see `enrichLeafKinds`).
  const enrichEnd = log.time('property-paths/enrich-leaf-kinds')
  const allPaths = [...out, ...rootPaths]
  const [enriched, datatypes, enumerations] = await Promise.all([
    enrichLeafKinds(store, allPaths),
    queryLeafDatatypes(store, allPaths),
    queryLeafEnumerations(store),
  ])
  for (const path of allPaths) {
    const kind = enriched.get(path.propertyIri)
    if (kind) path.leafKind = kind
    const datatype = datatypes.get(path.propertyIri)
    if (datatype) path.datatype = datatype
    const allowedValues = enumerations.get(`${path.owningClass}|${path.propertyIri}`)
    if (allowedValues) path.allowedValues = allowedValues
  }
  enrichEnd()

  log.info('Property paths discovered', {
    paths: out.length,
    vocabularyRootPaths: rootPaths.length,
    assetClasses: assetClasses.length,
    enrichedLeaves: enriched.size,
    durationMs: Date.now() - t0,
  })
  return { assetPaths: out, vocabularyRootPaths: rootPaths }
}

/**
 * A PropertyPath per (asset domain, reachable leaf), and one more per
 * further route to the leaf's owning class (see below).
 *
 * The domain of a path is the domain of the asset-domain row the traversal was
 * seeded from — NOT the namespace of the asset class IRI. Several domains may
 * declare the SAME asset class (an umbrella module that bundles another
 * domain's shapes, say): the class IRI then resolves to exactly one of their
 * namespaces, so deriving the domain from it would attribute every path to
 * that one domain and leave the others advertised as searchable but resolving
 * nothing. Seeding per row keeps each declaring domain's paths under its own
 * name; a class two domains share is simply traversed once per domain (the
 * traversal itself is memoised).
 *
 * Paths that need either discovery extension — a leaf whose owning class is
 * reached only by inheritance below the root, or a leaf that is literal only
 * through an `sh:or` member — are flagged `extended` and added last, only
 * for property local names that no plain path has in ANY domain, and once
 * per (domain, name). The compiler resolves properties by local name, not
 * only per domain: it picks the owning domains of a name (`ownersOf`), the
 * cross-domain OPTIONAL for a domain-less filter, and the validator's domain
 * correction all read every domain's paths. A new path for a name another
 * domain already resolves would change those queries; a new name cannot.
 * `buildCompilerVocabFrom` additionally keeps them off shape-group names.
 *
 * A plain path's owning class may be reached by several routes: one class
 * used in several contexts. Each further route adds a path flagged
 * `alternateRoute` right after the breadth-first one
 * ({@link alternateRoutesOf}), so every context is searchable and the bare
 * leaf name covers them all (`indexPropertyKeys` alternatives). The
 * breadth-first path is unchanged.
 *
 * @internal Exported for the domain-attribution regression test.
 */
export function emitPaths(
  assetDomains: readonly AssetDomainInfo[],
  leaves: LeafRow[],
  forwardEdges: Map<string, { predicate: string; child: string }[]>,
  ancestorsOf: (cls: string) => Set<string>
): PropertyPath[] {
  const out: PropertyPath[] = []
  const extended: PropertyPath[] = []
  const truncated = new Set<string>()
  // A class several domains declare is traversed once; only the name differs.
  const traversals = new Map<
    string,
    { predecessors: Map<string, PredecessorLink>; routes: Map<string, PathStep[][]> }
  >()
  for (const { domainName, assetClass } of assetDomains) {
    let traversal = traversals.get(assetClass)
    if (!traversal) {
      const roots = ancestorsOf(assetClass)
      const predecessors = bfsFromRoots(roots, forwardEdges, ancestorsOf)
      const found = routesFromRoots(roots, forwardEdges, MAX_ROUTES_PER_CLASS, predecessors)
      for (const cls of found.truncated) truncated.add(cls)
      traversal = { predecessors, routes: found.routes }
      traversals.set(assetClass, traversal)
    }
    const { predecessors, routes } = traversal
    for (const { owningClass, propertyIri, leafKind, viaDisjunction } of leaves) {
      const steps = pathStepsTo(owningClass, predecessors, propertyIri)
      if (!steps) continue
      const path: PropertyPath = {
        domain: domainName,
        propertyName: extractLocalName(propertyIri),
        propertyIri,
        assetClass,
        owningClass,
        steps,
        leafKind,
        ...(reachedAsAncestor(owningClass, predecessors) && { inheritedLeaf: true }),
      }
      if (viaDisjunction || reachedByInheritance(owningClass, predecessors)) {
        extended.push({ ...path, extended: true })
        continue
      }
      out.push(path, ...alternateRoutesOf(path, routes))
    }
  }
  if (truncated.size > 0) {
    log.warn('Classes reached by more routes than are kept; the rest are not searchable', {
      maxRoutesPerClass: MAX_ROUTES_PER_CLASS,
      classes: [...truncated].sort(),
    })
  }
  const plainNames = new Set(out.map((p) => p.propertyName))
  const added = new Set<string>()
  for (const path of extended) {
    const key = `${path.domain}:${path.propertyName}`
    if (plainNames.has(path.propertyName) || added.has(key)) continue
    added.add(key)
    out.push(path)
  }
  return out
}

/**
 * Derive cross-domain {@link ReferenceChain}s from discovered property paths —
 * the IRI/class-typed leaves that let the compiler join a parent asset to a
 * child asset domain. See {@link ReferenceChain} for the two flavours.
 */
export function buildReferenceChains(
  paths: PropertyPath[],
  registry?: DomainRegistry,
  knownAssetClasses?: Set<string>
): ReferenceChain[] {
  const out: ReferenceChain[] = []
  for (const path of paths) {
    if (path.leafKind === 'literal') continue
    // The compiler joins through the shortest chain, so a chain that needs a
    // discovery extension, or an alternate route of the same length, could
    // replace the join an existing cross-reference compiles to. Such paths
    // only ever add filterable properties.
    if (path.extended || path.alternateRoute) continue
    const parentDomain = path.domain || extractDomainFromRegistry(path.assetClass, registry)
    if (!parentDomain) continue

    if (path.leafKind === 'iri') {
      out.push({
        parentClass: path.assetClass,
        parentDomain,
        steps: path.steps,
        kind: 'iri',
      })
      continue
    }

    // path.leafKind === `class:${IRI}` — strip the prefix.
    const childClass = path.leafKind.slice('class:'.length)
    if (!childClass) continue
    if (knownAssetClasses && !knownAssetClasses.has(childClass)) continue
    const childDomain = extractDomainFromRegistry(childClass, registry)
    if (!childDomain) continue

    out.push({
      parentClass: path.assetClass,
      parentDomain,
      steps: path.steps,
      kind: 'class',
      childClass,
      childDomain,
    })
  }
  return out
}
