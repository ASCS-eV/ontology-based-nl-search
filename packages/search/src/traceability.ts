/**
 * Traceability explorer (WP3, task #19).
 *
 * Given an asset IRI, walks the outgoing `@id` references already present
 * in the instance graph and returns the lineage as a typed tree. Where
 * task #18 surfaces the one hop a JOIN walked, this module surfaces
 * *every* hop reachable from a result row — so users can navigate the
 * full validation chain (e.g. `scenario → ositrace → hdmap`) without
 * needing to express the chain as a query filter.
 *
 * Powered by the cached {@link ReferenceIndex}: each typed-source asset
 * already has its outgoing class-level edge signatures recorded
 * (predicate path + sample count). The walker uses each signature to
 * issue a focused SPARQL traversal that returns the actual bound IRIs
 * and labels for the specific source instance, then recurses up to
 * `depth` hops.
 *
 * Ontology-agnostic: the walker reads the index, not any ontology name.
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { getInitializedStore } from './init.js'
import {
  type DataReferenceEdge,
  getReferenceIndex,
  type ReferenceIndex,
} from './reference-index.js'

const log = createComponentLogger('traceability')

/** Default depth for lineage exploration — three hops covers the WP3 case. */
export const DEFAULT_LINEAGE_DEPTH = 3
/** Hard cap on recursion depth to bound work per request. */
export const MAX_LINEAGE_DEPTH = 6

export interface TraceabilityEdge {
  /** Ordered predicate IRIs along the path from parent to target. */
  predicatePath: string[]
  /** The reached node (recursively explored up to the depth budget). */
  target: TraceabilityNode
}

export interface TraceabilityNode {
  /** Asset IRI. */
  asset: string
  /** `rdfs:label` if present, else the asset IRI. */
  name: string
  /** Asset class IRI (e.g. `.../ositrace/v6/OSITrace`). */
  type: string
  /** Owning domain name (e.g. `ositrace`). Empty when the type doesn't resolve. */
  domain: string
  /**
   * Outgoing references. Empty when the depth budget is exhausted OR
   * the asset has no outgoing reference signatures in the index.
   */
  references: TraceabilityEdge[]
  /**
   * `true` when traversal stopped at this node because the depth
   * budget was exhausted (so the absent `references` may not be empty
   * in reality). The UI uses this to render a "more" affordance.
   */
  truncated: boolean
}

export interface LineageOptions {
  /** Maximum recursion depth. Clamped to [1, MAX_LINEAGE_DEPTH]. */
  depth?: number
}

/**
 * Build the outgoing-lineage tree from `assetIri`.
 *
 * Cycle-safe: tracks visited IRIs along the current path so the same
 * asset never appears twice in one branch. Different branches may
 * legitimately revisit (e.g. a shared HD map referenced from multiple
 * scenarios), so the guard is per-path, not global.
 */
export async function exploreLineage(
  assetIri: string,
  options: LineageOptions = {}
): Promise<TraceabilityNode> {
  const depth = clamp(options.depth ?? DEFAULT_LINEAGE_DEPTH, 1, MAX_LINEAGE_DEPTH)
  const end = log.time('explore')
  const [store, registry, index] = await Promise.all([
    getInitializedStore(),
    buildDomainRegistry(),
    getReferenceIndex(),
  ])
  // Asset-class IRIs are needed to pick the right type from a
  // multi-typed instance (target class + SHACL shape + …). Built from
  // the reference index's edges so the set stays data-driven and
  // doesn't drift from the gate `resolveKnownDomains` already applies.
  const assetClasses = new Set<string>()
  for (const edges of index.values()) {
    for (const edge of edges) {
      assetClasses.add(edge.sourceClass)
      assetClasses.add(edge.targetClass)
    }
  }
  const root = await buildNode(assetIri, store, registry, index, depth, new Set(), assetClasses)
  end()
  return root
}

async function buildNode(
  assetIri: string,
  store: SparqlStore,
  registry: DomainRegistry,
  index: ReferenceIndex,
  remainingDepth: number,
  visited: ReadonlySet<string>,
  assetClasses: ReadonlySet<string>
): Promise<TraceabilityNode> {
  const { type, name } = await loadTypeAndName(store, assetIri, assetClasses)
  const domain = type ? (registry.domainForIri(type) ?? '') : ''
  const node: TraceabilityNode = {
    asset: assetIri,
    name: name ?? assetIri,
    type: type ?? '',
    domain,
    references: [],
    truncated: false,
  }

  if (remainingDepth <= 0) {
    // Mark truncated only when there *would* be outgoing edges to walk;
    // otherwise we'd falsely advertise a "more" affordance for leaves.
    if (type && hasOutgoingEdges(index, domain, type)) node.truncated = true
    return node
  }

  if (!type || !domain) return node
  const candidateEdges = (index.get(domain) ?? []).filter((e) => e.sourceClass === type)
  if (candidateEdges.length === 0) return node

  const nextVisited = new Set(visited).add(assetIri)
  for (const edge of candidateEdges) {
    const targets = await loadEdgeTargets(store, assetIri, edge)
    for (const target of targets) {
      if (nextVisited.has(target)) continue
      const childNode = await buildNode(
        target,
        store,
        registry,
        index,
        remainingDepth - 1,
        nextVisited,
        assetClasses
      )
      node.references.push({ predicatePath: edge.predicatePath, target: childNode })
    }
  }
  return node
}

/**
 * Resolve the asset's type and label. Picks the FIRST type and label
 * encountered — multi-typed assets are rare in this ontology, and the
 * primary asset class is always declared. A missing label is normal
 * (intermediate blank nodes) and falls back to the IRI display-side.
 */
async function loadTypeAndName(
  store: SparqlStore,
  assetIri: string,
  assetClasses: ReadonlySet<string>
): Promise<{ type?: string; name?: string }> {
  // Blank-node values can never be valid SPARQL `<IRI>` subjects, so
  // refuse them up front rather than dispatching a query that the
  // engine will reject with a parser error.
  if (!isPlainIri(assetIri)) return {}
  // Fetch all types: a typed instance often has multiple `?asset a ?t`
  // triples (target class + SHACL shape membership + …). Pick the one
  // that's a known asset class so the walker's edge lookup matches.
  const sparql = `
    SELECT ?type ?name WHERE {
      <${assetIri}> a ?type .
      OPTIONAL { <${assetIri}> <http://www.w3.org/2000/01/rdf-schema#label> ?name }
    }
  `
  const result = await store.query(sparql)
  if (result.results.bindings.length === 0) return {}
  let type: string | undefined
  let name: string | undefined
  for (const row of result.results.bindings) {
    const t = row['type']?.value
    if (t && assetClasses.has(t)) type = t
    const n = row['name']?.value
    if (n && !name) name = n
  }
  // Fall back to the first type when none was a known asset class —
  // intermediate IRIs (e.g. external Linked-Data references) keep some
  // identity in the tree rather than dropping silently.
  if (!type) type = result.results.bindings[0]?.['type']?.value
  return { type, name }
}

/**
 * For one signature edge, return the actual bound target IRIs reachable
 * from `assetIri` along the predicate path. The path is emitted as
 * concrete `<IRI>/<IRI>/...` predicate steps so the query is exact —
 * no wildcard path needed because the index already chose the precise
 * chain.
 */
async function loadEdgeTargets(
  store: SparqlStore,
  assetIri: string,
  edge: DataReferenceEdge
): Promise<string[]> {
  if (!isPlainIri(assetIri)) return []
  const pathExpr = edge.predicatePath.map((p) => `<${p}>`).join('/')
  const sparql = `
    SELECT DISTINCT ?target WHERE {
      <${assetIri}> ${pathExpr} ?target .
      ?target a <${edge.targetClass}> .
      FILTER(isIRI(?target))
    }
  `
  const result = await store.query(sparql)
  const out: string[] = []
  for (const row of result.results.bindings) {
    const v = row['target']?.value
    if (v) out.push(v)
  }
  return out
}

/**
 * Heuristic: SPARQL `<IRI>` literals must wrap an absolute IRI — i.e.
 * one with a scheme like `http:`, `urn:`, `did:`. The stores we use
 * bind blank-node values as `_:bN`; some JSON-LD inputs also produce
 * skolemised hex identifiers with no scheme at all (e.g. a bare
 * 32-char hex string). Wrapping any of those in `<>` and dispatching
 * the query yields an Oxigraph parser error. This guard refuses them
 * up front so the walk degrades gracefully (the node ends as a leaf)
 * rather than crashing the whole lineage walk.
 */
function isPlainIri(value: string): boolean {
  if (!value || value.startsWith('_:')) return false
  // SPARQL IRIs can't contain `<` or `>` (delimiters) or whitespace.
  if (/[<>\s]/.test(value)) return false
  // Require a scheme prefix: `scheme:rest`. Schemes match the
  // `ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )` rule from RFC 3986.
  return /^[A-Za-z][A-Za-z0-9+\-.]*:/.test(value)
}

function hasOutgoingEdges(index: ReferenceIndex, domain: string, classIri: string): boolean {
  const edges = index.get(domain)
  if (!edges) return false
  return edges.some((e) => e.sourceClass === classIri)
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, Math.trunc(n)))
}
