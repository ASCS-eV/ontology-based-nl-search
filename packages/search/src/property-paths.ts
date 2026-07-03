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

import { bfsFromRoots, buildAncestorClosure, pathStepsTo } from './property-paths-graph.js'
import {
  enrichLeafKinds,
  queryLeafProperties,
  queryResolvedEdges,
} from './property-paths-queries.js'
import { queryAssetDomains, querySubClassEdges } from './schema-queries.js'

export type { LeafKind, PathStep, PropertyPath, ReferenceChain } from './property-paths-types.js'
import type { PropertyPath, ReferenceChain } from './property-paths-types.js'

const log = createComponentLogger('property-paths')

/** Extract the domain name for an IRI using registry or path convention. */
function extractDomainFromRegistry(iri: string, registry?: DomainRegistry): string {
  return extractDomain(iri, registry ? (i) => registry.domainForIri(i) : undefined)
}

export async function buildPropertyPaths(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<PropertyPath[]> {
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

  // For each asset class, walk forward and emit one PropertyPath per leaf
  // whose owning class is reachable.
  const bfsEnd = log.time('property-paths/bfs')
  const out: PropertyPath[] = []
  for (const assetClass of assetClasses) {
    const predecessors = bfsFromRoots(ancestorsOf(assetClass), forwardEdges)
    for (const { owningClass, propertyIri, leafKind } of leaves) {
      const steps = pathStepsTo(owningClass, predecessors, propertyIri)
      if (!steps) continue
      out.push({
        domain: extractDomainFromRegistry(assetClass, registry),
        propertyName: extractLocalName(propertyIri),
        propertyIri,
        assetClass,
        steps,
        leafKind,
      })
    }
  }
  bfsEnd()

  // Second pass: enrich leafKind from the schema graph for the leaves
  // that actually showed up in a discovered path. Done after BFS so the
  // hot leaf query stays minimal (see `enrichLeafKinds`).
  const enrichEnd = log.time('property-paths/enrich-leaf-kinds')
  const enriched = await enrichLeafKinds(store, out)
  for (const path of out) {
    const kind = enriched.get(path.propertyIri)
    if (kind) path.leafKind = kind
  }
  enrichEnd()

  log.info('Property paths discovered', {
    paths: out.length,
    assetClasses: assetClasses.length,
    enrichedLeaves: enriched.size,
    durationMs: Date.now() - t0,
  })
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
