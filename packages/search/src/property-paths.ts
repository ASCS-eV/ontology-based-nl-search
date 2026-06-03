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
import { createComponentLogger } from '@ontology-search/core/logging'
import { iri, sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'
import { queryAssetDomains } from './schema-queries.js'

const log = createComponentLogger('property-paths')

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
 * Whether a leaf property binds a literal value, an IRI, or a typed
 * sub-resource class. Determined from SHACL — `sh:nodeKind sh:IRI`,
 * `sh:class ?C`, or `sh:datatype xsd:foo` on the leaf property shape.
 *
 *  - `iri`        — leaf binds an IRI with no class constraint (e.g.
 *                   `manifest:iri`). The compiler can constrain the
 *                   bound resource separately with a `?leaf a Class`
 *                   pattern to express cross-domain references.
 *  - `class:<IRI>` — leaf binds an IRI typed as the named class. Direct
 *                   reference to a known sub-resource type.
 *  - `literal`    — default; leaf binds a typed literal (xsd:string,
 *                   xsd:integer, …).
 */
export type LeafKind = 'iri' | 'literal' | `class:${string}`

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
  /**
   * Kind of value bound by the leaf step. See {@link LeafKind}. Used
   * by the compiler to identify cross-reference chains (paths whose
   * leaf binds an IRI / typed class) versus value-filter chains
   * (paths whose leaf binds a literal).
   */
  leafKind: LeafKind
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
 * `sh:or` list membership is resolved with an `rdf:rest`-star / `rdf:first`
 * property path, kept in its OWN query (never inside a UNION) — Oxigraph WASM
 * traps ("unreachable") on `UNION` + property path, and evaluating a
 * fixed-depth list walk inside a UNION is pathologically slow (~33s for the
 * 4-deep walk this replaced; the split runs in ~25ms). Each membership form
 * (direct `sh:node`, `sh:or` member) is a separate query merged in TS. The
 * property path also handles `sh:or` lists of any length — the previous
 * fixed-depth UNION silently dropped members past the 4th.
 *
 * @see https://github.com/oxigraph/oxigraph/issues — UNION + rdf:rest* crash
 */
async function queryResolvedEdges(store: SparqlStore): Promise<ResolvedEdge[]> {
  // An edge is `parentClass --predicate--> childShape`, where the property
  // shape references the child shape either directly (`sh:node`) or as a
  // member of an `sh:or` disjunction list.
  //
  // Each reference form is its own UNION-free query, merged in TS, for two
  // reasons (both verified against the workspace ontology):
  //
  // 1. PERF: a fixed-depth `rdf:rest`/`rdf:first` list walk expressed *inside
  //    a UNION* makes Oxigraph WASM evaluate ~33s for a 4-deep walk (the
  //    planner re-runs the property-shape prefix join per branch over the
  //    blank-node list). The standalone `rdf:rest*/rdf:first` form is ~10ms.
  // 2. SAFETY: `UNION` combined with a property path traps the WASM runtime
  //    ("unreachable") — the same class of crash that forced the OPTIONAL
  //    split in `queryLeafProperties`. So the property path must live in its
  //    own query, never unioned.
  //
  // `rdf:rest*/rdf:first` also drops the previous hard cap of 4 sh:or members,
  // so arbitrarily long disjunction lists in other ontologies resolve too.
  //
  // Step 1a: edges where the child shape is referenced directly via sh:node.
  const directEdgeSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?parentClass ?predicate ?childShape WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        FILTER(isIRI(?predicate))
        ?propShape sh:node ?childShape .
      }
    }
  `

  // Step 1b: edges where the child shape is any member of an sh:or list.
  const orEdgeSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?parentClass ?predicate ?childShape WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?parentShape sh:targetClass ?parentClass .
        ?parentShape sh:property ?propShape .
        ?propShape sh:path ?predicate .
        FILTER(isIRI(?predicate))
        ?propShape sh:or ?list .
        ?list rdf:rest*/rdf:first ?item .
        ?item sh:node ?childShape .
      }
    }
  `

  // Step 2a: shapes that declare a target class directly.
  const directTargetSparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?shape ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?targetClass .
        FILTER(isIRI(?targetClass))
      }
    }
  `

  // Step 2b: shapes whose target class is reached through an sh:or member.
  const orTargetSparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT DISTINCT ?shape ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:or ?list .
        ?list rdf:rest*/rdf:first ?item .
        ?item sh:node ?inner .
        ?inner sh:targetClass ?targetClass .
        FILTER(isIRI(?targetClass))
      }
    }
  `

  const [directEdges, orEdges, directTargets, orTargets] = await Promise.all([
    store.query(directEdgeSparql),
    store.query(orEdgeSparql),
    store.query(directTargetSparql),
    store.query(orTargetSparql),
  ])

  // Build shape → targetClass[] lookup from both target forms.
  const shapeTargets = new Map<string, string[]>()
  for (const row of [...directTargets.results.bindings, ...orTargets.results.bindings]) {
    const shape = row['shape']?.value
    const targetClass = row['targetClass']?.value
    if (!shape || !targetClass) continue
    const list = shapeTargets.get(shape) ?? []
    list.push(targetClass)
    shapeTargets.set(shape, list)
  }

  // Resolve edges from both edge forms.
  const edges: ResolvedEdge[] = []
  const seen = new Set<string>()
  for (const row of [...directEdges.results.bindings, ...orEdges.results.bindings]) {
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

  // Sort deterministically. The downstream BFS reconstructs ONE path per
  // (asset, leaf) and breaks ties among equal-length paths by edge-insertion
  // order — so a stable edge order is what makes path discovery reproducible.
  // The previous fixed-depth UNION happened to emit sh:or members in RDF-list
  // order; the `rdf:rest*/rdf:first` property path does NOT (SPARQL leaves
  // path-result order unspecified), so without this sort the chosen
  // intermediate could flip between runs (e.g. a sensor leaf reachable via
  // both Camera and Lidar). Sorting by (parent, predicate, child) IRI makes
  // the choice independent of the engine's result order — the same
  // determinism discipline the rest of this module uses (see the chain sort
  // in compiler.ts).
  edges.sort(
    (a, b) =>
      a.parentClass.localeCompare(b.parentClass) ||
      a.predicate.localeCompare(b.predicate) ||
      a.childClass.localeCompare(b.childClass)
  )
  return edges
}

interface LeafRow {
  owningClass: string
  propertyIri: string
  leafKind: LeafKind
}

/**
 * Query every `(targetClass, leaf-predicate, leaf-iri)` triple — the
 * leaves of every property path. A leaf is a property shape with a
 * literal `sh:path` and NO `sh:node` (its values are RDF literals,
 * IRIs, or typed instances, not sub-resources to recurse into).
 *
 * Returns each leaf annotated with its {@link LeafKind} so the
 * compiler can distinguish literal-value leaves (used for filters
 * and ranges) from IRI / class-typed leaves (used to express
 * cross-domain references).
 *
 * Determined from SHACL: `sh:nodeKind sh:IRI` → `iri`, `sh:class ?C`
 * → `class:<IRI>`, anything else (including `sh:datatype xsd:foo`,
 * `sh:in`, or unconstrained) → `literal`.
 *
 * Implementation note (Oxigraph WASM): an OPTIONAL on both
 * `sh:nodeKind` and `sh:class` would be the obvious shape, but the
 * project hits OPTIONAL-correlated crashes in the WASM runtime on the
 * same workloads where `UNION + property-path *` crashes (see header
 * comment). The query is split into two SELECT runs and merged in TS.
 */
async function queryLeafProperties(store: SparqlStore): Promise<LeafRow[]> {
  // Single SELECT — the original 21a query, unchanged. Performance is
  // critical here because the result feeds the BFS in `buildPropertyPaths`,
  // which runs at compiler-vocab startup. The two extra `OPTIONAL`s the
  // earlier 21c draft tried (sh:nodeKind, sh:class) blew through the
  // 30s test timeout on the workspace ontology — Oxigraph WASM appears
  // to expand OPTIONAL over a property-shape blank-node graph
  // pathologically. Enrichment now happens via a separate query post-BFS
  // (see `enrichLeafKinds` below).
  const leafSparql = `
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
  const leafResult = await store.query(leafSparql)

  const leaves: LeafRow[] = []
  for (const row of leafResult.results.bindings) {
    const owningClass = row['owningClass']?.value
    const propertyIri = row['propertyIri']?.value
    if (!owningClass || !propertyIri) continue
    leaves.push({ owningClass, propertyIri, leafKind: 'literal' })
  }
  return leaves
}

/**
 * Discover the SHACL nodeKind / sh:class declaration on every leaf
 * property IRI used by the discovered paths. Runs as a second pass
 * against the schema graph so the hot BFS query in
 * `queryLeafProperties` stays minimal.
 *
 * Only IRIs that were already discovered as leaves are introspected
 * — properties never reached by a BFS path are skipped — so the
 * enrichment cost scales with the discovered-leaf count, not with
 * the total schema-graph size.
 */
async function enrichLeafKinds(
  store: SparqlStore,
  paths: PropertyPath[]
): Promise<Map<string, LeafKind>> {
  const propIris = new Set<string>()
  for (const p of paths) propIris.add(p.propertyIri)
  if (propIris.size === 0) return new Map()

  const valuesClause = [...propIris].map((iri) => `<${iri}>`).join(' ')
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?propertyIri ?nodeKind ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        VALUES ?propertyIri { ${valuesClause} }
        ?propShape sh:path ?propertyIri .
        { ?propShape sh:nodeKind ?nodeKind }
        UNION
        { ?propShape sh:class ?targetClass . FILTER(isIRI(?targetClass)) }
      }
    }
  `
  const result = await store.query(sparql)

  const SH_IRI = iri('sh', 'IRI')
  const out = new Map<string, LeafKind>()
  for (const row of result.results.bindings) {
    const pi = row['propertyIri']?.value
    if (!pi) continue
    const nodeKind = row['nodeKind']?.value
    const targetClass = row['targetClass']?.value
    // Prefer `class` over `iri` when both are declared on the same
    // property — `sh:class` carries strictly more information.
    if (targetClass && !out.get(pi)?.startsWith('class:')) {
      out.set(pi, `class:${targetClass}`)
    } else if (nodeKind === SH_IRI && !out.has(pi)) {
      out.set(pi, 'iri')
    }
  }
  return out
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
  // Each sub-step is logged with its own duration: this whole function
  // is the dominant cold-start cost (tens of seconds on a large schema
  // graph), and without per-phase timings the warmup is an opaque gap.
  const t0 = Date.now()
  const edgesEnd = log.time('property-paths/resolved-edges')
  const leavesEnd = log.time('property-paths/leaf-properties')
  const assetsEnd = log.time('property-paths/asset-domains')
  const [resolvedEdges, leaves, assetDomainRows] = await Promise.all([
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
  ])
  const assetClasses = assetDomainRows.map((row) => row.assetClass)
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
    const predecessors = bfsFromAsset(assetClass, forwardEdges)
    for (const { owningClass, propertyIri, leafKind } of leaves) {
      const steps = pathStepsTo(owningClass, predecessors, propertyIri)
      if (!steps) continue
      out.push({
        domain: extractDomain(assetClass, registry),
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
 * A discovered cross-domain reference chain.
 *
 * Replaces the hard-coded `?asset domain:hasManifest ?m ; ?m
 * manifest:hasReferencedArtifacts ?link ; ?link manifest:iri ?refAsset`
 * pattern. For any ontology that expresses cross-asset references
 * declaratively in SHACL — whether via a manifest pattern, a direct
 * `references` property, or some other structure — the compiler reads
 * the actual predicate chain from this set.
 *
 * Two flavours emerge from {@link LeafKind}:
 *
 *   - `kind: 'iri'`   — the leaf binds an unconstrained IRI. The
 *                       compiler can pair the chain with a runtime
 *                       `?refAsset a <ChildClass>` constraint to
 *                       address any child asset domain via this path.
 *                       (ENVITED-X manifest pattern uses this shape.)
 *   - `kind: 'class'` — the leaf binds an IRI typed as the named
 *                       child asset class. The chain is the join to
 *                       exactly that child domain; no extra type
 *                       constraint needed.
 */
export interface ReferenceChain {
  /** Parent asset class IRI at the root of the chain. */
  parentClass: string
  /** Parent domain name (e.g. `hdmap`). */
  parentDomain: string
  /** Predicates to walk from the parent variable to the bound IRI. */
  steps: PathStep[]
  /**
   * `iri` for open-ended IRI-leaf chains (compiler supplies the
   * `?refAsset a <ChildClass>` constraint at emission time);
   * `class` for chains whose leaf SHACL declares `sh:class` directly.
   */
  kind: 'iri' | 'class'
  /**
   * For `kind: 'class'`, the IRI of the constrained child asset class.
   * For `kind: 'iri'`, undefined — child domain is determined at the
   * compiler's call site.
   */
  childClass?: string
  /**
   * For `kind: 'class'`, the resolved child domain name. For `kind:
   * 'iri'`, undefined.
   */
  childDomain?: string
}

/**
 * Derive cross-domain reference chains from the discovered property
 * paths. Selects paths whose leaf binds an IRI or a typed class, then
 * groups them by parent asset class.
 *
 * Ontology-agnostic: works against any SHACL that declares cross-
 * references via `sh:nodeKind sh:IRI` or `sh:class`, regardless of
 * whether the predicate naming follows the ENVITED-X manifest pattern.
 */
export function buildReferenceChains(
  paths: PropertyPath[],
  registry?: DomainRegistry,
  knownAssetClasses?: Set<string>
): ReferenceChain[] {
  const out: ReferenceChain[] = []
  for (const path of paths) {
    if (path.leafKind === 'literal') continue
    const parentDomain = path.domain || extractDomain(path.assetClass, registry)
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
    const childDomain = extractDomain(childClass, registry)
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
