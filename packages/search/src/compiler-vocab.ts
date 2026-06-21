/**
 * Compiler vocabulary — the graph-derived indexes the SPARQL compiler reads.
 *
 * Extracted from `compiler.ts` (ADR 0003, decomposition step 1): this module
 * owns the *discovery + caching* half of the compiler — building `CompilerVocab`
 * (properties, shape groups, range-2D, property paths, reference chains) and the
 * domain-reference map from the SHACL schema graph, plus the warmup that
 * pre-pays that cold-start cost. The slot→SPARQL emission half stays in
 * `compiler.ts` and imports these. The dependency is one-way (compiler → vocab):
 * nothing here imports the emit core, so there is no cycle.
 *
 * Caches are stored as in-flight Promises so concurrent cold-start callers share
 * one build (the ontology graph is immutable at runtime).
 */
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { getAssetDomains } from './asset-domains.js'
import { getConceptExpansionIndex } from './concept-expansion.js'
import { getInitializedStore } from './init.js'
import {
  buildPropertyPaths,
  buildReferenceChains,
  type PropertyPath,
  type ReferenceChain,
} from './property-paths.js'
import { getReferenceIndex } from './reference-index.js'
import {
  queryAssetDomains,
  queryDomainReferences,
  queryPropertyDomains,
  queryPropertyShapeGroups,
  queryRange2DProperties,
} from './schema-queries.js'

/** Property info from ontology - supports properties existing in multiple domains */
export interface CompilerProperty {
  /** All domains that define this property (a property local name shared by more than one domain) */
  domains: Set<string>
  /** Map from domain → IRI for this property in that domain */
  iris: Map<string, string>
}

export interface CompilerVocab {
  properties: Map<string, CompilerProperty>
  /** Property shape group classification from SHACL nesting (Content, Format, Quantity, etc.) */
  shapeGroups: Map<string, string>
  /** All property local names that appear in shapeGroups (for O(1) isKnownProperty checks) */
  shapeGroupPropertyNames: Set<string>
  /**
   * Properties that wrap a numeric min/max interval, keyed by leaf local
   * name. The value carries the SHACL-discovered lower/upper-bound predicate
   * IRIs so the compiler emits those instead of literal `:min`/`:max`.
   */
  range2DProperties: Map<string, { minPredicate: string; maxPredicate: string }>
  /**
   * Discovered property paths keyed by `${domain}:${propertyLocalName}`.
   * Each path lists the predicate hops from an asset class to the leaf
   * value — the compiler reads predicates from these instead of
   * hard-coding any specification/group predicate literals.
   *
   * Sourced from `buildPropertyPaths`, so the meta-model structure is
   * discovered from the schema graph, not assumed at compile time.
   */
  paths: Map<string, PropertyPath>
  /**
   * Discovered cross-domain reference chains keyed by parent domain.
   * Each chain lists the predicate hops from a parent asset class to
   * an IRI-typed leaf that the compiler can bind to a child asset.
   *
   * Sourced from `buildReferenceChains`. Drives the generic
   * cross-reference SPARQL emission, with the chain of reference
   * predicates discovered from the schema rather than hard-coded.
   *
   * Values are the chains for that parent — multiple variants are
   * possible (e.g. an IRI-leaf chain plus a direct typed-reference
   * chain) and the compiler picks deterministically.
   */
  referenceChains: Map<string, ReferenceChain[]>
}

/**
 * Cached compiler vocabulary. Stored as the in-flight Promise rather
 * than the resolved value so concurrent callers share one build —
 * without this, three SSE requests landing inside the cold-start
 * window each spawn their own `buildPropertyPaths` invocation
 * against the 22-domain SHACL graph (compounds to multi-minute
 * latency, observed empirically). The ontology graph is immutable at
 * runtime, so a single build is enough for the process lifetime.
 */
let cachedCompilerVocabPromise: Promise<CompilerVocab> | null = null

/**
 * Build the compiler vocabulary from the ontology schema graph via
 * SPARQL queries. Exported (intra-package only — not on the public
 * surface of `@ontology-search/search`) so the metadata index can
 * reuse the same `shapeGroups` and `paths` indices the compiler
 * builds, avoiding parallel discovery and drift.
 */
export async function getCompilerVocab(): Promise<CompilerVocab> {
  if (cachedCompilerVocabPromise) return cachedCompilerVocabPromise
  cachedCompilerVocabPromise = buildCompilerVocab()
  return cachedCompilerVocabPromise
}

async function buildCompilerVocab(): Promise<CompilerVocab> {
  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()
  return buildCompilerVocabFrom(store, registry)
}

/**
 * Build the compiler vocabulary from an explicit store + registry. Extracted
 * from {@link buildCompilerVocab} so tests can build a vocab against a fixture
 * graph (an arbitrary schema) without the global store/registry singletons —
 * the seam the flat-ontology compile test needs to drive `compileSlots`.
 */
export async function buildCompilerVocabFrom(
  store: SparqlStore,
  registry: DomainRegistry
): Promise<CompilerVocab> {
  const [propertyDomains, shapeGroupInfos, range2DInfos, propertyPaths] = await Promise.all([
    queryPropertyDomains(store, registry),
    queryPropertyShapeGroups(store, registry),
    queryRange2DProperties(store, registry),
    buildPropertyPaths(store, registry),
  ])

  const properties = new Map<string, CompilerProperty>()

  // Build multi-domain property index directly from SHACL shapes
  for (const { localName, domain, iri } of propertyDomains) {
    const existing = properties.get(localName)
    if (existing) {
      existing.domains.add(domain)
      existing.iris.set(domain, iri)
    } else {
      properties.set(localName, {
        domains: new Set([domain]),
        iris: new Map([[domain, iri]]),
      })
    }
  }

  // Build shape group index: "propName:domain" → shapeGroup
  // Also collect distinct property names for O(1) isKnownProperty checks.
  const shapeGroups = new Map<string, string>()
  const shapeGroupPropertyNames = new Set<string>()
  for (const { localName, domain, shapeGroup } of shapeGroupInfos) {
    shapeGroups.set(`${localName}:${domain}`, shapeGroup)
    shapeGroupPropertyNames.add(localName)
  }

  // Build Range2D property index: leaf local name → discovered min/max predicates.
  const range2DProperties = new Map<string, { minPredicate: string; maxPredicate: string }>()
  for (const { localName, minPredicate, maxPredicate } of range2DInfos) {
    range2DProperties.set(localName, { minPredicate, maxPredicate })
  }

  // Index property paths by (domain, propertyLocalName) for O(1) lookup
  // when emitting triples. A property local name may legitimately appear in
  // multiple asset domains; each domain gets its own path.
  const paths = new Map<string, PropertyPath>()
  for (const path of propertyPaths) {
    paths.set(`${path.domain}:${path.propertyName}`, path)
  }

  // Discover cross-domain reference chains from the property paths, so
  // cross-references are emitted without hard-coding any reference-predicate
  // chain.
  const assetClassIris = new Set<string>()
  for (const desc of registry.domains.values()) {
    assetClassIris.add(desc.targetClassIri)
  }
  const referenceChainList = buildReferenceChains(propertyPaths, registry, assetClassIris)
  const referenceChains = new Map<string, ReferenceChain[]>()
  // Sort deterministically by chain length (shorter chains preferred)
  // then by joined predicate string, so the compiler picks the same
  // chain across invocations regardless of the SHACL graph's iteration order.
  for (const chain of [...referenceChainList].sort((a, b) => {
    if (a.steps.length !== b.steps.length) return a.steps.length - b.steps.length
    const aJoined = a.steps.map((s) => s.predicate).join('|')
    const bJoined = b.steps.map((s) => s.predicate).join('|')
    return aJoined.localeCompare(bJoined)
  })) {
    const list = referenceChains.get(chain.parentDomain) ?? []
    list.push(chain)
    referenceChains.set(chain.parentDomain, list)
  }

  return {
    properties,
    shapeGroups,
    shapeGroupPropertyNames,
    range2DProperties,
    paths,
    referenceChains,
  }
}

/**
 * Pre-build every cached graph-derived index the compiler needs so the
 * first user query doesn't pay the cold-start cost. The compiler vocab
 * build (property-path BFS + leaf-kind enrichment + reference-chain
 * discovery) is the single most expensive startup step — observed at
 * ~39s on the 22-domain workspace ontology. Calling this from the API
 * warmup moves that cost off the request hot path.
 *
 * Idempotent: each underlying getter memoizes its in-flight Promise,
 * so a second call is a no-op.
 */
export async function warmupCompiler(): Promise<void> {
  const store = await getInitializedStore()
  await Promise.all([
    getCompilerVocab(),
    getAssetDomains(),
    getDomainReferences(),
    // Data-driven reference index for traceability: the
    // SHACL-discovered chains describe what *can* be linked; this index
    // records what *is* linked in the loaded instance data, including
    // multi-hop paths through blank-node manifest links.
    getReferenceIndex(),
    // The concept-expansion index (SKOS hierarchy) is consumed by the
    // LLM slot pipeline, not the compiler — but it's the same kind of
    // one-time graph-derived build, so warm it here alongside the rest.
    getConceptExpansionIndex(store),
  ])
}

/**
 * Cached domain references. Stored as the in-flight Promise (see
 * `cachedCompilerVocabPromise` for the rationale).
 */
let cachedDomainReferencesPromise: Promise<Map<string, Set<string>>> | null = null

/** Get domain reference relationships from the ontology graph */
export async function getDomainReferences(): Promise<Map<string, Set<string>>> {
  if (cachedDomainReferencesPromise) return cachedDomainReferencesPromise
  cachedDomainReferencesPromise = buildDomainReferences()
  return cachedDomainReferencesPromise
}

async function buildDomainReferences(): Promise<Map<string, Set<string>>> {
  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()

  // Get asset domain infos to filter references to known asset classes
  const assetDomainInfos = await queryAssetDomains(store, registry)
  const knownAssetClasses = new Set(assetDomainInfos.map((d) => d.assetClass))

  const refs = await queryDomainReferences(store, registry, knownAssetClasses)
  const map = new Map<string, Set<string>>()

  for (const { parentDomain, childDomain } of refs) {
    const existing = map.get(parentDomain)
    if (existing) {
      existing.add(childDomain)
    } else {
      map.set(parentDomain, new Set([childDomain]))
    }
  }

  return map
}
