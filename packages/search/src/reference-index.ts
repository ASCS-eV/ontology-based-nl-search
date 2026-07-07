/**
 * Schema-derived reference index.
 *
 * Walks the SHAPES graph at startup; for every asset class, follows the
 * declared property structure (`sh:node` / `sh:qualifiedValueShape`
 * descents, `sh:class` targets, open `sh:nodeKind sh:IRI` leaves) and
 * records every (sourceClass, predicatePath, targetClass) signature the
 * ontology declares — including chains a domain only inherits through a
 * shared shape, which the compiler's leaf-path discovery collapses away.
 *
 * Signatures are declarations, not observations: a reference type that no
 * instance uses yet still appears (that missing link is exactly the kind
 * of data gap the product exists to surface), and the index is complete
 * before any instance data loads. Open IRI leaves fan out to every other
 * asset class — the declared shape can point at any asset, and the
 * compiler adds the concrete type constraint at emission time.
 *
 * Used by the SPARQL compiler to emit precise JOIN patterns when
 * `slots.references` is set, and by the traceability layer to expose the
 * chain to the user (whose live queries then show which declared links
 * the data actually populates).
 *
 * Ontology-agnostic: every signature comes from standard SHACL structure
 * ([SHACL] §2.3 property shapes, §4.1.3 sh:class, §4.1.2 sh:nodeKind,
 * §5 sh:node) — no ontology-specific predicate or class name appears here.
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { getAssetDomains } from './asset-domains.js'
import { getInitializedStore } from './init.js'
import { SCHEMA_GRAPH } from './schema-loader.js'

const log = createComponentLogger('reference-index')

/**
 * Maximum shape descents to follow from an asset class before stopping.
 * The deepest declared chains in practice (a JSON-LD link indirection)
 * reach 4 hops; 6 leaves headroom without risking combinatorial walks.
 */
const MAX_DEPTH = 6

/**
 * One declared link between two asset classes, generalised to a
 * class-level signature.
 */
export interface DataReferenceEdge {
  /** Source asset class IRI (e.g. ".../<domain>/<version>/<Class>"). */
  sourceClass: string
  /** Source domain name. */
  sourceDomain: string
  /** Target asset class IRI. */
  targetClass: string
  /** Target domain name. */
  targetDomain: string
  /**
   * Ordered predicate IRIs along the declared path. A direct `sh:class`
   * reference has one entry; the JSON-LD manifest pattern is typically
   * three to four entries.
   */
  predicatePath: string[]
  /**
   * Declared-signature marker, kept for consumer compatibility: every
   * schema-derived edge carries 1, so shortest-path selection decides
   * and ties break deterministically by build order.
   */
  sampleCount: number
}

/**
 * Declared link graph: source-domain name → list of edges that
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

/**
 * Pick the declared edge from `parentDomain` to `childDomain` that the
 * data actually populates: candidates are probed shortest-first with one
 * bounded lookup each — live querying at request time, never
 * pre-analysis.
 *
 * Three passes, strongest evidence first:
 *  1. a candidate whose path reaches an instance of the TARGET class;
 *  2. a candidate whose path is populated toward ANY value — structural
 *     evidence that instances use this spelling (e.g. the manifest
 *     indirection), even if none points at the requested target yet;
 *  3. the shortest declared edge — the compiler still emits an honest
 *     JOIN whose empty result is exactly the data gap the user asked
 *     about.
 */
export async function pickLiveReferenceEdge(
  store: SparqlStore,
  index: ReferenceIndex,
  parentDomain: string,
  childDomain: string
): Promise<DataReferenceEdge | null> {
  // Build order already sorts each domain's edges shortest-path-first.
  const candidates = (index.get(parentDomain) ?? []).filter((e) => e.targetDomain === childDomain)
  if (candidates.length === 0) return null

  for (const edge of candidates) {
    const probe = await store.query(`
      SELECT ?s WHERE {
        ?s a <${edge.sourceClass}> .
        ?s ${pathExpression(edge)} ?t .
        ?t a <${edge.targetClass}> .
      }
      LIMIT 1
    `)
    if (probe.results.bindings.length > 0) return edge
  }

  for (const edge of candidates) {
    const probe = await store.query(`
      SELECT ?s WHERE {
        ?s a <${edge.sourceClass}> .
        ?s ${pathExpression(edge)} ?t .
      }
      LIMIT 1
    `)
    if (probe.results.bindings.length > 0) return edge
  }

  return candidates[0] ?? null
}

function pathExpression(edge: DataReferenceEdge): string {
  return edge.predicatePath.map((p) => `<${p}>`).join('/')
}

/** One declared property constraint on a shape, as walked by the BFS. */
interface ShapeProperty {
  predicate: string
  /**
   * sh:node / sh:qualifiedValueShape target shapes, when declared —
   * directly on the property shape or inside sh:or/sh:xone/sh:and
   * alternatives (a property may admit several link forms).
   */
  nodeShapes: string[]
  /** sh:class target, when declared. */
  targetClass?: string
  /** True when the value is declared an IRI (sh:nodeKind sh:IRI…). */
  iriLeaf: boolean
}

/**
 * Build the index from the shapes graph. Two SPARQL queries pull the
 * shape targets and property structure; everything else is an in-memory
 * walk over shapes. No instance data is touched — the default graph is
 * never queried.
 */
async function buildReferenceIndex(): Promise<ReferenceIndex> {
  const end = log.time('build')
  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()
  const assetDomains = await getAssetDomains()

  // Asset class IRI → domain. Only classes whose owning domain is in the
  // discovered asset-domain set count as endpoints — matches the gate
  // `resolveKnownDomains` already applies.
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

  const [shapeTargets, propertiesByShape] = await Promise.all([
    loadShapeTargets(store),
    loadShapeProperties(store),
  ])

  // A property can only carry an asset reference when a loaded ontology
  // declares it — an open IRI leaf whose predicate lives in a foundation
  // vocabulary (shacl#conformsTo, rdfs:seeAlso, …) points at schema-level
  // resources, not assets. Registry-driven, so the rule needs no namespace
  // list of its own.
  const isOntologyPredicate = (predicate: string): boolean =>
    registry.domainForIri(predicate) !== undefined

  const bySignature = new Map<string, DataReferenceEdge>()
  for (const [sourceClass, { domain: sourceDomain }] of assetClassByIri) {
    for (const shape of shapeTargets.shapesByClass.get(sourceClass) ?? []) {
      walkShape(
        shape,
        sourceClass,
        sourceDomain,
        [],
        new Set([shape]),
        propertiesByShape,
        shapeTargets,
        assetClassByIri,
        isOntologyPredicate,
        bySignature
      )
    }
  }

  // Group by source-domain, deterministically ordered so tie-breaking in
  // the pickers is stable across builds.
  const byDomain = new Map<string, DataReferenceEdge[]>()
  const sorted = [...bySignature.values()].sort(
    (a, b) =>
      a.sourceDomain.localeCompare(b.sourceDomain) ||
      a.predicatePath.length - b.predicatePath.length ||
      a.targetDomain.localeCompare(b.targetDomain) ||
      a.predicatePath.join(' ').localeCompare(b.predicatePath.join(' '))
  )
  for (const edge of sorted) {
    const existing = byDomain.get(edge.sourceDomain)
    if (existing) existing.push(edge)
    else byDomain.set(edge.sourceDomain, [edge])
  }

  end()
  log.info('Reference index built from shape declarations', {
    edgeSignatures: bySignature.size,
    sourceDomains: byDomain.size,
  })
  return byDomain
}

/** Both directions of the sh:targetClass relation. */
interface ShapeTargets {
  shapesByClass: Map<string, string[]>
  classesByShape: Map<string, string[]>
}

/**
 * Depth-first walk over the declared shape structure. Every property
 * either terminates the path (an asset-class target or an open IRI leaf)
 * or descends into its declared node shape.
 */
function walkShape(
  shape: string,
  sourceClass: string,
  sourceDomain: string,
  path: string[],
  visited: Set<string>,
  propertiesByShape: Map<string, ShapeProperty[]>,
  shapeTargets: ShapeTargets,
  assetClassByIri: Map<string, { domain: string }>,
  isOntologyPredicate: (predicate: string) => boolean,
  out: Map<string, DataReferenceEdge>
): void {
  if (path.length >= MAX_DEPTH) return

  const recordAssetTarget = (targetClass: string, nextPath: string[]): void => {
    const target = assetClassByIri.get(targetClass)
    if (target && targetClass !== sourceClass) {
      record(out, sourceClass, sourceDomain, targetClass, target.domain, nextPath)
    }
  }

  for (const property of propertiesByShape.get(shape) ?? []) {
    const nextPath = [...path, property.predicate]

    // Direct class-typed reference: terminal when it names an asset class,
    // then descend into the class's own shape(s) for onward links. The
    // cycle guard is PATH-LOCAL (cloned per branch): sibling properties
    // legitimately reuse the same shared shape (two link properties both
    // declared via one LinkShape) and each spelling is its own signature.
    if (property.targetClass) {
      recordAssetTarget(property.targetClass, nextPath)
      for (const classShape of shapeTargets.shapesByClass.get(property.targetClass) ?? []) {
        if (!visited.has(classShape)) {
          walkShape(
            classShape,
            sourceClass,
            sourceDomain,
            nextPath,
            new Set([...visited, classShape]),
            propertiesByShape,
            shapeTargets,
            assetClassByIri,
            isOntologyPredicate,
            out
          )
        }
      }
    }

    // Nested shape (sh:node / sh:qualifiedValueShape, possibly behind
    // sh:or/sh:and alternatives): terminal when the shape's own target
    // class is an asset class, and descend through it either way — this
    // is how chains inherited via shared shapes stay visible.
    for (const nodeShape of property.nodeShapes) {
      for (const declaredClass of shapeTargets.classesByShape.get(nodeShape) ?? []) {
        recordAssetTarget(declaredClass, nextPath)
      }
      if (visited.has(nodeShape)) continue
      walkShape(
        nodeShape,
        sourceClass,
        sourceDomain,
        nextPath,
        new Set([...visited, nodeShape]),
        propertiesByShape,
        shapeTargets,
        assetClassByIri,
        isOntologyPredicate,
        out
      )
    }

    // Open IRI leaf: the declared shape can point at ANY asset. Fan out to
    // every other asset class — zero-instance reference types included —
    // and let the compiler constrain the concrete type at emission time.
    // Foundation-vocabulary predicates never carry asset references.
    if (
      property.iriLeaf &&
      !property.targetClass &&
      property.nodeShapes.length === 0 &&
      isOntologyPredicate(property.predicate)
    ) {
      for (const [targetClass, { domain: targetDomain }] of assetClassByIri) {
        if (targetClass === sourceClass) continue
        record(out, sourceClass, sourceDomain, targetClass, targetDomain, nextPath)
      }
    }
  }
}

function record(
  out: Map<string, DataReferenceEdge>,
  sourceClass: string,
  sourceDomain: string,
  targetClass: string,
  targetDomain: string,
  predicatePath: string[]
): void {
  const signature = `${sourceClass}|${predicatePath.join('')}|${targetClass}`
  if (out.has(signature)) return
  out.set(signature, {
    sourceClass,
    sourceDomain,
    targetClass,
    targetDomain,
    predicatePath,
    sampleCount: 1,
  })
}

/** Both directions of the sh:targetClass relation, one query. */
async function loadShapeTargets(store: SparqlStore): Promise<ShapeTargets> {
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT ?shape ?class WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?class .
        FILTER(isIRI(?shape))
      }
    }
  `
  const result = await store.query(sparql)
  const shapesByClass = new Map<string, string[]>()
  const classesByShape = new Map<string, string[]>()
  for (const row of result.results.bindings) {
    const shape = row['shape']?.value
    const cls = row['class']?.value
    if (!shape || !cls) continue
    push(shapesByClass, cls, shape)
    push(classesByShape, shape, cls)
  }
  return { shapesByClass, classesByShape }
}

/**
 * Shape IRI → its declared property constraints.
 *
 * Constraints may sit directly on the property shape or inside
 * sh:or / sh:xone / sh:and alternative lists. The starred combinator
 * property path in the query walks every nesting level (each step is a
 * combinator followed by an rdf list traversal); zero repetitions match
 * the property shape itself. `sh:qualifiedValueShape` is treated like
 * `sh:node` (both name the shape the value must satisfy); a `sh:nodeKind`
 * permitting IRIs marks an open reference leaf.
 */
async function loadShapeProperties(store: SparqlStore): Promise<Map<string, ShapeProperty[]>> {
  const sparql = `
    ${sparqlPrefixes('sh', 'rdf')}

    SELECT ?shape ?ps ?path ?constraint ?node ?qvs ?class ?nodeKind ?inlineProp WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:property ?ps .
        ?ps sh:path ?path .
        FILTER(isIRI(?path))
        ?ps ((sh:or|sh:xone|sh:and)/rdf:rest*/rdf:first)* ?constraint .
        OPTIONAL { ?constraint sh:node ?node }
        OPTIONAL { ?constraint sh:qualifiedValueShape ?qvs }
        OPTIONAL { ?constraint sh:class ?class }
        OPTIONAL { ?constraint sh:nodeKind ?nodeKind }
        OPTIONAL { ?constraint sh:property ?inlineProp }
      }
    }
  `
  const result = await store.query(sparql)

  // Merge the per-constraint rows into one ShapeProperty per (shape, path).
  const merged = new Map<string, ShapeProperty & { shape: string }>()
  for (const row of result.results.bindings) {
    const shape = row['shape']?.value
    const ps = row['ps']?.value
    const predicate = row['path']?.value
    if (!shape || !predicate) continue

    const key = `${shape}|${predicate}`
    const property = merged.get(key) ?? { shape, predicate, nodeShapes: [], iriLeaf: false }

    const nodeShape = row['node']?.value ?? row['qvs']?.value
    if (nodeShape && !property.nodeShapes.includes(nodeShape)) property.nodeShapes.push(nodeShape)
    // A combinator alternative that declares its own sh:property blocks is
    // an INLINE anonymous shape — descend into it like a named sh:node.
    // Both loader queries run against the same store session, so its
    // blank-node identifier is consistent between them.
    const constraint = row['constraint']?.value
    if (
      constraint &&
      constraint !== ps &&
      row['inlineProp']?.value &&
      !property.nodeShapes.includes(constraint)
    ) {
      property.nodeShapes.push(constraint)
    }
    const targetClass = row['class']?.value
    if (targetClass) property.targetClass ??= targetClass
    const nodeKind = row['nodeKind']?.value ?? ''
    if (/#(IRI|BlankNodeOrIRI|IRIOrLiteral)$/.test(nodeKind)) property.iriLeaf = true

    merged.set(key, property)
  }

  const map = new Map<string, ShapeProperty[]>()
  for (const { shape, ...property } of merged.values()) {
    push(map, shape, property)
  }
  return map
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key)
  if (existing) existing.push(value)
  else map.set(key, [value])
}
