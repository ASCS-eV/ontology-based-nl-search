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
import { indexPropertyKeys, keyOfIndexEntry } from './property-keys.js'
import {
  buildReferenceChains,
  discoverPropertyPaths,
  type PropertyPath,
  type ReferenceChain,
} from './property-paths.js'
import { getReferenceIndex } from './reference-index.js'
import {
  queryAssetClassVocabularies,
  queryAssetDomains,
  queryDomainReferences,
  queryPropertyDomains,
  queryPropertyShapeGroups,
  queryRange2DProperties,
} from './schema-queries.js'
import { type NarrowerValues, queryNarrowerValues } from './value-hierarchy.js'

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
   * Discovered property paths keyed by `${domain}:${key}`, one per predicate
   * chain (ADR 0009, `indexPropertyKeys`): the key is the leaf's local name,
   * or a qualified key when the domain reaches that leaf name through more
   * than one chain. Each path lists the predicate hops from an asset class to
   * the leaf value — the compiler reads predicates from these instead of
   * hard-coding any specification/group predicate literals.
   *
   * Sourced from `buildPropertyPaths`, so the meta-model structure is
   * discovered from the schema graph, not assumed at compile time.
   */
  paths: Map<string, PropertyPath>
  /**
   * `${domain}:${leafName}` → every chain's path, for a leaf name the domain
   * reaches through more than one predicate chain. The bare name is a key
   * that matches any of them. Optional so hand-built fixture vocabs need not
   * supply it.
   */
  alternatives?: Map<string, PropertyPath[]>
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
  /**
   * Standalone entry classes of non-asset vocabularies, keyed by vocabulary
   * domain, each with its leaf paths keyed by property local name. Lets the
   * compiler find documents typed only with such a vocabulary (not attached
   * to any asset). Sourced from `discoverPropertyPaths` /
   * `findVocabularyRoots`; sorted by root class. Optional so hand-built
   * fixture vocabs need not supply it.
   */
  vocabularyRoots?: Map<string, VocabularyRootPaths[]>
  /**
   * The schema's value hierarchy: broader value IRI → the values directly
   * below it (`queryNarrowerValues`). The compiler expands an IRI filter value
   * with it. Optional so hand-built fixture vocabs need not supply it.
   */
  narrowerValues?: NarrowerValues
  /**
   * Per domain, the vocabularies its primary class is a subclass of a class
   * of (`queryAssetClassVocabularies`): every asset of the domain is described
   * with them by type. Optional so hand-built fixture vocabs need not supply it.
   */
  assetClassVocabularies?: ReadonlyMap<string, ReadonlySet<string>>
}

/** One standalone vocabulary entry class and the leaf paths it reaches. */
export interface VocabularyRootPaths {
  rootClass: string
  /** Paths keyed by key (no domain prefix); keys are assigned per vocabulary. */
  paths: Map<string, PropertyPath>
  /** Leaf name → this root's chains, for a name the root reaches more than one way. */
  alternatives?: Map<string, PropertyPath[]>
}

/** One property the compiler can resolve, with the slot key that names it. */
export interface KeyedPropertyPath {
  key: string
  path: PropertyPath
}

/**
 * Every property the compiler can resolve, by key: the asset-rooted paths
 * PLUS the leaf paths of the standalone vocabulary roots, once per
 * (domain, key).
 *
 * Both surfaces are the property universe — a vocabulary published on its own
 * (not nested inside any asset) compiles through `vocabularyRoots`, and some
 * domains are reachable ONLY that way. Consumers that enumerate "all
 * properties" read this helper rather than `paths` alone, which holds the
 * asset-rooted paths only.
 */
export function allPropertyKeys(vocab: CompilerVocab): KeyedPropertyPath[] {
  const out: KeyedPropertyPath[] = []
  const seen = new Set<string>()
  const add = (domain: string, key: string, path: PropertyPath) => {
    if (seen.has(`${domain}:${key}`)) return
    seen.add(`${domain}:${key}`)
    out.push({ key, path })
  }
  for (const [indexKey, path] of vocab.paths) add(path.domain, keyOfIndexEntry(indexKey), path)
  for (const [domain, roots] of vocab.vocabularyRoots ?? []) {
    for (const root of roots) for (const [key, path] of root.paths) add(domain, key, path)
  }
  return out
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
  const [
    propertyDomains,
    shapeGroupInfos,
    range2DInfos,
    discovered,
    narrowerValues,
    assetClassVocabularies,
  ] = await Promise.all([
    queryPropertyDomains(store, registry),
    queryPropertyShapeGroups(store, registry),
    queryRange2DProperties(store, registry),
    discoverPropertyPaths(store, registry),
    queryNarrowerValues(store),
    queryAssetClassVocabularies(store, registry),
  ])
  const propertyPaths = discovered.assetPaths

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

  // Index property paths by (domain, key) for O(1) lookup when emitting
  // triples: one key per predicate chain (ADR 0009). A property local name may
  // legitimately appear in multiple asset domains; each domain gets its own
  // keys.
  //
  // An `extended` path (a leaf reached only through inheritance below the
  // asset class, or literal only through an `sh:or` member) never carries a
  // shape-group property name. Shape-group emission takes its hops from the
  // path of ANY property in the group (`lookupStepPredicate`), and such a
  // name can resolve through its group without a path of its own, so a new
  // path for it — one inherited from a superclass shape, say — would change
  // the hops of queries that compiled before. (`buildPropertyPaths` already
  // keeps extended paths off every name that has a plain path.)
  const { byKey: paths, alternatives } = indexPropertyKeys(
    propertyPaths.filter(
      (path) => !(path.extended && shapeGroupPropertyNames.has(path.propertyName))
    )
  )

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
    alternatives,
    referenceChains,
    vocabularyRoots: indexVocabularyRoots(discovered.vocabularyRootPaths),
    narrowerValues,
    assetClassVocabularies,
  }
}

/**
 * Group standalone-root paths by vocabulary domain → root class, keyed by key.
 *
 * Keys are assigned once per vocabulary over every root's paths
 * (`indexPropertyKeys` over the paths with the root class taken out of the
 * route), so one chain has one key in every root that reaches it, and the
 * same chain reached from several entry classes is not mistaken for several
 * properties. Each root then holds the keys of the chains it reaches, and
 * the alternatives of a name it reaches more than one way.
 */
function indexVocabularyRoots(rootPaths: PropertyPath[]): Map<string, VocabularyRootPaths[]> {
  const chainKey = (path: PropertyPath) =>
    `${path.domain}|${path.propertyName}|${path.steps.map((s) => s.predicate).join(' ')}`
  // One key per (vocabulary, chain), whatever root reaches it.
  const { byKey } = indexPropertyKeys(rootPaths)
  const keyOfChain = new Map<string, string>()
  for (const [indexKey, path] of byKey) keyOfChain.set(chainKey(path), keyOfIndexEntry(indexKey))

  const byRoot = new Map<string, Map<string, PropertyPath[]>>()
  for (const path of rootPaths) {
    const rootId = `${path.domain}|${path.assetClass}`
    const paths = byRoot.get(rootId) ?? new Map<string, PropertyPath[]>()
    byRoot.set(rootId, paths)
    paths.set(path.propertyName, [...(paths.get(path.propertyName) ?? []), path])
  }

  const out = new Map<string, VocabularyRootPaths[]>()
  for (const rootId of [...byRoot.keys()].sort()) {
    const [domain, rootClass] = rootId.split('|') as [string, string]
    const { byKey: rootKeys, alternatives } = indexPropertyKeys(
      [...byRoot.get(rootId)!.values()].flat()
    )
    const paths = new Map<string, PropertyPath>()
    for (const path of rootKeys.values()) paths.set(keyOfChain.get(chainKey(path))!, path)
    const rootAlternatives = new Map<string, PropertyPath[]>()
    for (const [indexKey, list] of alternatives) {
      rootAlternatives.set(keyOfIndexEntry(indexKey), list)
    }
    // A name ambiguous in the vocabulary but reached one way from this root
    // still answers to its bare name here.
    for (const path of rootKeys.values()) {
      if (!paths.has(path.propertyName) && !rootAlternatives.has(path.propertyName)) {
        rootAlternatives.set(path.propertyName, [path])
      }
    }
    const entries = out.get(domain) ?? []
    entries.push({
      rootClass,
      paths,
      ...(rootAlternatives.size > 0 ? { alternatives: rootAlternatives } : {}),
    })
    out.set(domain, entries)
  }
  return out
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
