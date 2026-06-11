/**
 * Generic SPARQL Compiler — compiles SearchSlots into SPARQL SELECT queries.
 *
 * Design: Domain-agnostic and graph-driven. Uses the DomainRegistry plus
 * `schema-queries.ts` to derive compiler metadata from the SHACL schema graph
 * instead of hardcoded domain constants.
 *
 * `CompilerVocab` caches three graph-derived indexes for compilation:
 * properties, shapeGroups, and range2DProperties.
 *
 * Cross-domain support: When filters span multiple ontology domains (e.g.,
 * scenario + hdmap), the compiler identifies the primary domain (the one that
 * references others via manifest:hasReferencedArtifacts) and builds a join.
 *
 * Architecture pattern: All ENVITED-X ontology domains follow a consistent
 * structure: Asset → hasDomainSpecification → (hasContent, hasFormat,
 * hasQuantity, hasQuality, hasDataSource, hasGeoreference).
 * This compiler exploits that regularity.
 *
 * @see https://www.w3.org/TR/sparql11-query/
 */
import { getConfig } from '@ontology-search/core/config'
import { CompileError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'
import { iri, sparqlPrefix } from '@ontology-search/core/rdf/prefixes'
import {
  buildDomainRegistry,
  type DomainDescriptor,
  type DomainRegistry,
} from '@ontology-search/ontology/domain-registry'
import { escapeSparqlLiteral, isIri } from '@ontology-search/sparql/escape'
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
import {
  type DataReferenceEdge,
  getReferenceIndex,
  type ReferenceIndex,
} from './reference-index.js'
import {
  queryAssetDomains,
  queryDomainReferences,
  queryPropertyDomains,
  queryPropertyShapeGroups,
  queryRange2DProperties,
} from './schema-queries.js'
import type {
  CompileResult,
  ReferenceFilter,
  SearchSlots,
  TraceabilityPlan,
  TraceabilityStep,
} from './slots.js'
import { normalizeReferences } from './slots.js'
import { validateSparql } from './sparql-validator.js'

/** Property info from ontology - supports properties existing in multiple domains */
interface CompilerProperty {
  /** All domains that define this property (e.g., roadTypes in both hdmap and ositrace) */
  domains: Set<string>
  /** Map from domain → IRI for this property in that domain */
  iris: Map<string, string>
}

interface CompilerVocab {
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
   * hard-coding `hasDomainSpecification` and `has${Group}` literals.
   *
   * Contains the SHORTEST path per key (backward-compatible with pre-
   * Phase 2 behaviour). For access to ALL discovered routes, see
   * {@link allPaths}.
   *
   * Sourced from `buildPropertyPaths` (task 21a) so the ENVITED-X
   * meta-model is no longer a compile-time assumption.
   */
  paths: Map<string, PropertyPath>
  /**
   * ALL discovered property paths per `${domain}:${propertyLocalName}`
   * key, sorted shortest-first. A leaf reachable via N intermediate
   * routes produces N entries. Phase 3 uses this for intelligent path
   * selection and merging when multiple active filters share
   * intermediate shapes.
   */
  allPaths: Map<string, PropertyPath[]>
  /**
   * Discovered cross-domain reference chains keyed by parent domain.
   * Each chain lists the predicate hops from a parent asset class to
   * an IRI-typed leaf that the compiler can bind to a child asset.
   *
   * Sourced from `buildReferenceChains` (task 21c). Drives the
   * generic cross-reference SPARQL emission that replaced the
   * literal `hasManifest → hasReferencedArtifacts → iri` chain.
   *
   * Values are the chains for that parent — multiple variants are
   * possible (e.g. `manifest:iri` chain plus a direct
   * `references` chain) and the compiler picks deterministically.
   */
  referenceChains: Map<string, ReferenceChain[]>
}

// `escapeSparqlLiteral` + `isIri` are sourced from
// `@ontology-search/sparql/escape` (re-exported here so the existing
// `@ontology-search/search` public surface — used by the api app — keeps
// shipping `escapeSparqlLiteral`).
export { escapeSparqlLiteral } from '@ontology-search/sparql/escape'

const log = createComponentLogger('compiler')

/**
 * Assemble a complete SPARQL SELECT query from its constituent parts.
 * Centralizes the query-tail pattern used by both single-domain and
 * cross-domain compilation. The LIMIT defaults to the operator-tunable
 * `SPARQL_DEFAULT_LIMIT` config field; the policy gate enforces the
 * separate `SPARQL_MAX_LIMIT` ceiling (the Zod schema rejects configs
 * where the default would exceed the ceiling).
 */
function assembleQuery(
  prefixes: string,
  selectVars: string[] | Set<string>,
  patterns: string[],
  optionals: string[],
  filters: string[],
  limit: number = getConfig().SPARQL_DEFAULT_LIMIT,
  distinctSubjectVar?: string
): string {
  const vars = selectVars instanceof Set ? [...selectVars] : selectVars
  const selectClause = `SELECT ${vars.join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')

  let query: string
  if (distinctSubjectVar) {
    // Limit DISTINCT subjects, not rows. A cross-reference JOIN fans out (one
    // row per referenced asset), so a plain row-level LIMIT would silently
    // truncate distinct matching assets (a trace with 2 referenced maps eats 2
    // of the LIMIT). Select the limited distinct subjects in a sub-SELECT, then
    // re-state the body to bind every projected column for exactly those
    // subjects. The outer row cap is a safety net (SPARQL_MAX_LIMIT, which the
    // policy enforces anyway); the inner LIMIT is the real distinct-asset bound.
    const maxLimit = getConfig().SPARQL_MAX_LIMIT
    query =
      `${prefixes}\n${selectClause} WHERE {\n` +
      `  { SELECT DISTINCT ${distinctSubjectVar} WHERE {\n  ${whereBody}\n  } LIMIT ${limit} }\n` +
      `  ${whereBody}\n}\nLIMIT ${maxLimit}`
  } else {
    query = `${prefixes}\n${selectClause} WHERE {\n  ${whereBody}\n}\nLIMIT ${limit}`
  }

  // Post-assembly validation: catch syntax errors and W3C compliance issues
  const validation = validateSparql(query)
  if (!validation.valid) {
    log.error('Generated SPARQL has errors', undefined, { errors: validation.errors })
  }
  if (validation.warnings.length > 0) {
    log.warn('Generated SPARQL has warnings', { warnings: validation.warnings })
  }

  return query
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
 * graph (a non-ENVITED-X schema) without the global store/registry singletons —
 * the seam the flat-ontology compile test needs to drive {@link compileSlots}.
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
  // when emitting triples. A property may legitimately appear in multiple
  // asset domains (e.g., roadTypes in both hdmap and ositrace); each
  // domain gets its own path.
  //
  // Phase 2: `allPaths` stores every discovered route (sorted shortest-
  // first per key). `paths` retains only the shortest per key for
  // backward-compatible single-path lookup.
  const allPaths = new Map<string, PropertyPath[]>()
  for (const path of propertyPaths) {
    const key = `${path.domain}:${path.propertyName}`
    const list = allPaths.get(key) ?? []
    list.push(path)
    allPaths.set(key, list)
  }
  // Sort each bucket shortest-first, then pick [0] for the primary index.
  const paths = new Map<string, PropertyPath>()
  for (const [key, bucket] of allPaths) {
    bucket.sort((a, b) => a.steps.length - b.steps.length)
    if (bucket[0]) paths.set(key, bucket[0])
  }

  // Discover cross-domain reference chains from the property paths.
  // Used to emit cross-references without hard-coding `hasManifest →
  // hasReferencedArtifacts → iri` (task 21c).
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
    allPaths,
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

// `getAssetDomains` moved to `./asset-domains.js` to break the
// compiler ↔ reference-index import cycle (criterion 6 / madge gate).
// It is imported above and re-exported from the package index there.

/**
 * Cached domain references. Stored as the in-flight Promise (see
 * `cachedCompilerVocabPromise` for the rationale).
 */
let cachedDomainReferencesPromise: Promise<Map<string, Set<string>>> | null = null

/** Get domain reference relationships from the ontology graph */
async function getDomainReferences(): Promise<Map<string, Set<string>>> {
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

/**
 * Detect whether the given domains have a parent-child referencing
 * relationship (e.g., scenario references hdmap). Returns true only when
 * at least one domain in the set references another domain in the set.
 */
function detectHierarchy(domains: string[], domainRefs: Map<string, Set<string>>): boolean {
  const domainSet = new Set(domains)
  for (const [parent, children] of domainRefs.entries()) {
    if (domainSet.has(parent)) {
      for (const child of children) {
        if (domainSet.has(child)) return true
      }
    }
  }
  return false
}

/**
 * Compile a UNION query for peer domains — independent asset types that
 * share similar properties (e.g., hdmap + ositrace both have roadTypes).
 *
 * Generates one UNION arm per domain, each with the domain-specific
 * patterns, filters, and location constraints. Shared FILTER clauses
 * (location, license) are placed outside the UNION.
 */
async function compilePeerDomainUnion(
  slots: SearchSlots,
  domains: string[],
  filtersByDomain: Record<string, Record<string, string | string[]>>,
  rangesByDomain: Record<string, Record<string, { min?: number; max?: number }>>,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): Promise<string> {
  const prefixDomains = new Set<string>()
  const selectVars = new Set(['?asset', '?name'])
  const outerFilters: string[] = []

  // Build UNION arms
  const unionArms: string[] = []
  const hasFilters = Object.values(filtersByDomain).some((f) => Object.keys(f).length > 0)
  const hasRanges = Object.values(rangesByDomain).some((r) => Object.keys(r).length > 0)
  const queryHasConstraints = hasFilters || hasRanges

  for (const domainName of domains) {
    const domain = registry.domains.get(domainName)
    if (!domain) continue

    const domainFilters = filtersByDomain[domainName] || {}
    const domainRanges = rangesByDomain[domainName] || {}
    const domainHasConstraints =
      Object.keys(domainFilters).length > 0 || Object.keys(domainRanges).length > 0

    // Skip domains with zero applicable constraints when the query
    // clearly intends to filter. This prevents UNION arms that return
    // ALL assets from a domain unrelated to the search intent.
    //
    // Log the skip so a consumer auditing the trace can correlate
    // their selected-domain set with what actually got compiled —
    // silently dropping a domain is the worst kind of misclassification
    // because the user can't tell from the SPARQL why their query
    // returned fewer rows than expected. The slot validator surfaces
    // a per-key gap upstream when filters are dropped at the value
    // level; this log covers the complementary case where the key was
    // valid but the discovery found no chain to it in this domain.
    if (queryHasConstraints && !domainHasConstraints) {
      log.warn('UNION arm skipped — domain has no discovered property path for any filter', {
        domain: domainName,
        requestedFilters: Object.keys(filtersByDomain).concat(Object.keys(rangesByDomain)),
      })
      continue
    }

    prefixDomains.add(domainName)

    const armPatterns: string[] = []
    const armFilters: string[] = []
    const armOptionals: string[] = []
    const armSelectVars = new Set<string>()

    // Base pattern — asset type + label
    armPatterns.push(`?asset a ${domain.targetClass} ;`)
    armPatterns.push('  rdfs:label ?name .')

    // Build domain-specific patterns
    const foreignDomains = buildDomainPatterns(
      domainName,
      domain,
      domainFilters,
      domainRanges,
      armPatterns,
      armFilters,
      armOptionals,
      armSelectVars,
      vocabIndex,
      registry,
      '?asset',
      '?domSpec'
    )
    for (const fd of foreignDomains) prefixDomains.add(fd)
    for (const v of armSelectVars) selectVars.add(v)

    // Combine arm into a single block
    const armBody = [...armPatterns, ...armOptionals, ...armFilters]
      .map((line) => `    ${line}`)
      .join('\n')
    unionArms.push(`  {\n${armBody}\n  }`)
  }

  // License — task 21d folded license into normal `filters` keyed by
  // the SHACL leaf local name. License chains are emitted by the
  // generic deep-filter machinery inside `buildDomainPatterns` (one
  // chain per UNION arm). No outer license OPTIONAL block needed.

  // Build the UNION body
  const unionBody = unionArms.join('\n  UNION\n')
  const patterns = [unionBody]
  const optionals: string[] = []

  // Generate prefixes
  const prefixes = buildPrefixes(registry, [...prefixDomains])

  return assembleQuery(prefixes, selectVars, patterns, optionals, outerFilters)
}

/**
 * Compile structured search slots into a valid SPARQL SELECT query.
 * Resolves the target domain(s) from the registry and builds
 * appropriate graph patterns.
 *
 * When multiple peer domains are selected (no parent-child reference),
 * generates a UNION query searching all domains independently.
 *
 * When filters span domains with a referencing hierarchy (e.g.,
 * scenario referencing hdmap), identifies the primary (composite)
 * domain and generates a join via manifest:hasReferencedArtifacts.
 *
 * When no domain is specified and no filters exist, searches across ALL
 * asset types using discovered asset domain classes.
 */
/**
 * Normalize an LLM-supplied domain name toward the registry's directory-name
 * convention: lowercase, hyphens at camelCase boundaries, spaces/underscores
 * to hyphens. Handles variants like "Environment Model", "EnvironmentModel",
 * "environment_model" → "environment-model". Idempotent.
 */
export function normalizeDomainName(domain: string): string {
  return domain
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

/**
 * Filter a domain list to those that are valid primary search targets —
 * i.e. **asset** domains, discovered data-drivenly from the SHACL /
 * `rdfs:subClassOf` hierarchy (see `queryAssetDomains`). Drops:
 *
 *   - Phantom names (LLM-hallucinated "unknown", typos, sentinels from a
 *     failed IRI attribution) — not in the registry at all.
 *   - Non-asset support vocabularies (`gx`, `georeference`, `manifest`, …)
 *     that the registry knows about but that don't root any asset class in
 *     the discovered subclass hierarchy. The compiler would otherwise emit
 *     a primary `?asset a <Class>` UNION arm using the registry's arbitrary
 *     `targetClass` pick (e.g. `gx:AccessControlManagement`), which has
 *     nothing to do with the query and returns zero rows.
 *
 * Order-preserving and de-duplicated. Names are canonicalized to the
 * registry's directory key (so an IRI-segment input like `openlabel` maps
 * to the registry key `openlabel-v2`) before downstream lookup.
 *
 * Nothing about any specific ontology is hardcoded: the asset-domain set
 * comes from `getAssetDomains()`, which queries the graph.
 */
export async function resolveKnownDomains(domains: string[]): Promise<string[]> {
  const registry = await buildDomainRegistry()
  const assetDomains = await getAssetDomains()
  const seen = new Set<string>()
  const known: string[] = []
  for (const raw of domains) {
    const name = normalizeDomainName(raw)
    const canonical = registry.domains.has(name) ? name : registry.resolveByIriDomain(name)?.name
    if (!canonical || seen.has(canonical)) continue
    if (assetDomains.has(canonical)) {
      seen.add(canonical)
      known.push(canonical)
    }
  }
  return known
}

/**
 * Backward-compatible wrapper that returns the SPARQL string only.
 * Callers that don't need the traceability plan keep their existing
 * `const sparql = await compileSlots(slots)` shape. New callers (the
 * service emitting per-row breadcrumbs) use {@link compileSlotsWithTrace}.
 */
export async function compileSlots(slots: SearchSlots): Promise<string> {
  const { sparql } = await compileSlotsWithTrace(slots)
  return sparql
}

/**
 * Optional dependency overrides for {@link compileSlotsWithTrace}.
 *
 * Production callers pass nothing — the global disk-derived registry and the
 * cached global vocab are used. Tests inject a fixture-built registry + vocab
 * to drive the compiler against a non-ENVITED-X schema (the seam the
 * flat-ontology compile test needs). Only the deps a single-domain compile
 * reads are overridable; cross-domain / references paths still consult the
 * global asset-domain and reference indexes.
 */
export interface CompileOverrides {
  registry?: DomainRegistry
  vocabIndex?: CompilerVocab
}

/**
 * Compile slots and return the SPARQL plus, when the query contains
 * cross-reference JOINs, one {@link TraceabilityPlan} per reference that the
 * service uses to assemble per-row, per-reference breadcrumbs from the bound
 * intermediate variables.
 *
 * Same compilation semantics as {@link compileSlots} — the wrapper just
 * drops the `trace` field when its caller doesn't ask for it.
 */
export async function compileSlotsWithTrace(
  slots: SearchSlots,
  overrides?: CompileOverrides
): Promise<CompileResult> {
  const [registry, vocabIndex] = await Promise.all([
    overrides?.registry ?? buildDomainRegistry(),
    overrides?.vocabIndex ?? getCompilerVocab(),
  ])

  // Traceability plans accumulated when the query contains cross-reference
  // JOINs — one per projected reference. The service uses them to attach a
  // per-row, per-reference breadcrumb. Stays empty for
  // non-references queries.
  const traces: TraceabilityPlan[] = []

  // References that could not be compiled (no SHACL chain, no data edge,
  // no sibling path). Reported back to the caller so it can surface a gap.
  const droppedReferences: string[] = []

  // Normalize domain names so downstream registry lookups and prefix
  // resolution see the directory-name convention regardless of how the LLM
  // capitalized or spaced them.
  slots = {
    ...slots,
    domains: slots.domains.map(normalizeDomainName),
  }

  // When no domain is specified, use cross-domain search
  if (slots.domains.length === 0) {
    const assetDomains = await getAssetDomains()
    return { sparql: compileCrossDomainQuery(slots, registry, assetDomains, vocabIndex) }
  }

  const detectedDomains = slots.domains

  // Partition filters by domain
  const filtersByDomain = partitionFiltersByDomain(slots.filters, detectedDomains, vocabIndex)

  // Partition ranges by domain
  const rangesByDomain = partitionRangesByDomain(slots.ranges, detectedDomains, vocabIndex)

  // Determine whether the domains are peers (no parent-child relationship)
  // or have a referencing hierarchy. Peer domains get a UNION query; parent-child
  // domains get a JOIN via manifest:hasReferencedArtifacts.
  // Only multi-domain queries can have a parent-child hierarchy, so the
  // (global) reference index is consulted only then — a single-domain compile
  // stays free of the cross-domain discovery dependency.
  const hasHierarchy =
    detectedDomains.length > 1 && detectHierarchy(detectedDomains, await getDomainReferences())

  if (!hasHierarchy && detectedDomains.length > 1) {
    // Peer domains: generate UNION query that searches all domains independently
    return {
      sparql: await compilePeerDomainUnion(
        slots,
        detectedDomains,
        filtersByDomain,
        rangesByDomain,
        registry,
        vocabIndex
      ),
    }
  }

  // Determine primary domain — the one that references others, or the single domain
  const primaryDomain = await resolvePrimaryDomain(detectedDomains, filtersByDomain)
  const domain = registry.domains.get(primaryDomain)

  if (!domain) {
    throw new CompileError(
      `Unknown domain: ${primaryDomain}. Available: ${registry.domainNames.join(', ')}`
    )
  }

  // Collect initial prefix domains (will be augmented with foreign domains
  // discovered during pattern generation, e.g., openlabel-v2 properties
  // used inside an hdmap query).
  const prefixDomains = new Set([primaryDomain])
  for (const d of Object.keys(filtersByDomain)) {
    prefixDomains.add(d)
  }
  for (const d of Object.keys(rangesByDomain)) {
    prefixDomains.add(d)
  }
  // Include all user-selected domains so their prefixes are available for
  // pattern generation. Unused prefixes are stripped in assembleQuery().
  for (const d of detectedDomains) {
    prefixDomains.add(d)
  }

  const patterns: string[] = []
  const filters: string[] = []
  const optionals: string[] = []
  const selectVars = new Set(['?asset', '?name'])
  // Set once any cross-reference JOIN is emitted: those fan out (one row per
  // referenced asset), so the query must LIMIT distinct assets, not rows.
  let hasReferenceJoin = false

  // Base pattern — primary asset type + label
  patterns.push(`?asset a ${domain.targetClass} ;`)
  patterns.push('  rdfs:label ?name .')

  // Build patterns for the primary domain's own filters
  const primaryFilters = filtersByDomain[primaryDomain] || {}
  const primaryRanges = rangesByDomain[primaryDomain] || {}
  const primaryForeign = buildDomainPatterns(
    primaryDomain,
    domain,
    primaryFilters,
    primaryRanges,
    patterns,
    filters,
    optionals,
    selectVars,
    vocabIndex,
    registry,
    '?asset',
    '?domSpec'
  )
  for (const fd of primaryForeign) prefixDomains.add(fd)

  // Build cross-domain joins for referenced domains. Only include
  // domains that have actual filters or ranges — domains selected by
  // the LLM but without constraints are skipped to avoid mandatory
  // JOINs that would eliminate results. (Task 21d removed the special-
  // case "delegate location to referenced domain" logic — location
  // fields now flow through `slots.filters` and partition naturally
  // to whichever domain owns the matching property path.)
  const allReferencedDomains = new Set([
    ...Object.keys(filtersByDomain).filter((d) => d !== primaryDomain),
    ...Object.keys(rangesByDomain).filter((d) => d !== primaryDomain),
    ...detectedDomains.filter((d) => d !== primaryDomain),
  ])

  for (const refDomainName of allReferencedDomains) {
    const refDomain = registry.domains.get(refDomainName)
    if (!refDomain) continue

    const refFilters = filtersByDomain[refDomainName] || {}
    const refRanges = rangesByDomain[refDomainName] || {}

    // Skip referenced domains that have no filters or ranges —
    // they add only mandatory JOIN constraints with no value.
    const hasRefConstraints =
      Object.keys(refFilters).length > 0 || Object.keys(refRanges).length > 0
    if (!hasRefConstraints) continue

    // Join via the discovered cross-reference chain (task 21c). No
    // ENVITED-X meta-model predicates are baked in here — the chain
    // comes from `vocabIndex.referenceChains` populated by
    // `buildReferenceChains` from SHACL leaf properties whose binding
    // shape allows an IRI value (`sh:nodeKind sh:IRI` or `sh:class`).
    // When no chain is declared in the schema we skip the join with a
    // logger warning rather than inventing a literal predicate path.
    const refVar = `?ref_${refDomainName.replace(/-/g, '_')}`
    const refSpecVar = `?refSpec_${refDomainName.replace(/-/g, '_')}`

    const chain = pickReferenceChain(vocabIndex, primaryDomain, refDomainName)
    if (!chain) {
      log.warn(
        'No cross-reference chain declared in SHACL for parent → child; skipping referenced domain',
        { parent: primaryDomain, child: refDomainName }
      )
      continue
    }
    emitReferenceChainTriples(
      chain,
      '?asset',
      refVar,
      refDomain.targetClass,
      registry,
      `m_${refDomainName.replace(/-/g, '_')}`,
      patterns,
      prefixDomains
    )

    const refForeign = buildDomainPatterns(
      refDomainName,
      refDomain,
      refFilters,
      refRanges,
      patterns,
      filters,
      optionals,
      selectVars,
      vocabIndex,
      registry,
      refVar,
      refSpecVar
    )
    for (const fd of refForeign) prefixDomains.add(fd)
    hasReferenceJoin = true
  }

  // License — task 21d folded `license` into regular `slots.filters`
  // keyed by the SHACL leaf local name. The chain is emitted by the
  // generic deep-filter machinery in buildDomainPatterns, so no
  // license-specific OPTIONAL block is needed here.

  // Cross-reference join driven by the explicit `slots.references` slot.
  // Resolution precedence (most precise first):
  //   1. SHACL-declared chain via `pickReferenceChain` — used when the
  //      parent's shape inlines a typed leaf to the child class.
  //   2. Data-driven path from the reference index — used when the SHACL
  //      declaration is transitive (e.g. inherited via a shared
  //      `manifest:ManifestShape`) and the index has observed the actual
  //      instance-graph chain.
  //   3. Generic any-predicate property path `(!<urn:none>)+` — last
  //      resort when neither SHACL nor instance data declare a link.
  // Entries are AND-combined (the asset must reference all of them) and may
  // NEST: a reference's own `references` chain one hop deeper (parent ref →
  // child), so "traces with maps" becomes scenario → trace → map rather than
  // scenario → trace AND scenario → map. Every node is projected and each with
  // a resolved chain contributes its own breadcrumb plan. The distinct-asset
  // wrap (assembleQuery) keeps the LIMIT counting primary assets despite the
  // (now deeper) reference fan-out. See `emitReferenceNode`.
  const referenceSlots = normalizeReferences(slots.references)

  /**
   * Emit one reference node and recurse into its nested references.
   *
   * `parentVar`/`parentDomain` anchor the JOIN (the primary `?asset` at the
   * top level, or an enclosing reference's var for a nested chain). `varBase`
   * is the projected variable name (no `?`): depth-0 siblings are
   * `refAsset`, `refAsset1`, …; a nested child appends `_<index>`
   * (`refAsset_0`, `refAsset_0_0`). The breadcrumb plan is keyed by the node's
   * var and roots at its parent, so the UI can attach each chain to the right
   * (possibly nested) pill.
   */
  const emitReferenceNode = async (
    ref: ReferenceFilter,
    parentVar: string,
    parentDomain: string,
    varBase: string
  ): Promise<void> => {
    const refDomain = registry.domains.get(ref.domain)
    if (!refDomain) return

    const refVar = `?${varBase}`
    const refNameVar = `?${varBase.replace('refAsset', 'refName')}`
    const tag = varBase.replace('refAsset', 'refSlot') // chain intermediate id-tag
    const dataPrefix = varBase.replace('refAsset', 'ref') // data-path step prefix
    const traceSteps: TraceabilityStep[] = []

    const chain = pickReferenceChain(vocabIndex, parentDomain, ref.domain)
    if (chain) {
      emitReferenceChainTriples(
        chain,
        parentVar,
        refVar,
        refDomain.targetClass,
        registry,
        tag,
        patterns,
        prefixDomains,
        traceSteps
      )
    } else {
      // Load the data-driven reference index lazily: only queries with a
      // references slot AND no SHACL chain consult it (cached / pre-warmed).
      const referenceIndex = await getReferenceIndex()
      const dataPath = pickDataReferenceEdge(referenceIndex, parentDomain, ref.domain)
      if (dataPath) {
        emitDataReferencePath(
          dataPath,
          parentVar,
          refVar,
          patterns,
          registry,
          prefixDomains,
          traceSteps,
          dataPrefix
        )
        patterns.push(`${refVar} a ${refDomain.targetClass} .`)
        log.info('slots.references: emitting JOIN from data-driven reference index', {
          parent: parentDomain,
          child: ref.domain,
          hops: dataPath.predicatePath.length,
          samples: dataPath.sampleCount,
        })
      } else {
        // No exact match in the data index. Fall back to a sibling edge
        // from the same parent — the manifest IRI endpoint is generic and
        // can reach any asset type via the same predicate path.
        const siblingPath = pickSiblingDataEdge(referenceIndex, parentDomain)
        if (siblingPath) {
          emitDataReferencePath(
            siblingPath,
            parentVar,
            refVar,
            patterns,
            registry,
            prefixDomains,
            traceSteps,
            dataPrefix
          )
          patterns.push(`${refVar} a ${refDomain.targetClass} .`)
          log.info('slots.references: emitting JOIN from sibling data edge (no exact match)', {
            parent: parentDomain,
            child: ref.domain,
            siblingTarget: siblingPath.targetDomain,
            hops: siblingPath.predicatePath.length,
          })
        } else {
          // No path discoverable from SHACL, data, or siblings. Skip this
          // reference — emitting a wildcard property-path is too expensive
          // and semantically incorrect (no evidence the link exists).
          log.warn(
            'slots.references: no SHACL chain, data path, or sibling edge; skipping reference',
            { parent: parentDomain, child: ref.domain }
          )
          droppedReferences.push(ref.domain)
          return
        }
      }
    }

    // Chain resolution succeeded — mark this reference as emitted.
    prefixDomains.add(ref.domain)
    hasReferenceJoin = true

    // Bind a label for every reference so each referenced asset can be
    // displayed (and so a label filter can apply to any of them).
    patterns.push(`${refVar} rdfs:label ${refNameVar} .`)
    if (ref.label) {
      filters.push(
        `FILTER(CONTAINS(LCASE(${refNameVar}), "${escapeSparqlLiteral(ref.label.toLowerCase())}"))`
      )
    }

    // Project this reference's asset + name so the UI shows it.
    selectVars.add(refVar)
    selectVars.add(refNameVar)

    // A resolved chain contributes a breadcrumb: promote its intermediate step
    // variables so the service can read them per row, and record a plan keyed
    // by this node's var, rooted at its parent. The wildcard branch records no
    // steps, so it adds no plan.
    if (traceSteps.length > 0) {
      for (const step of traceSteps) selectVars.add(`?${step.variable}`)
      traces.push({
        sourceVariable: parentVar.slice(1),
        targetVariable: varBase,
        steps: traceSteps,
      })
    }

    // Recurse: nested references hang off this node (parent → child chain).
    const nested = ref.references ?? []
    for (let j = 0; j < nested.length; j++) {
      await emitReferenceNode(nested[j]!, refVar, ref.domain, `${varBase}_${j}`)
    }
  }

  for (let i = 0; i < referenceSlots.length; i++) {
    await emitReferenceNode(
      referenceSlots[i]!,
      '?asset',
      primaryDomain,
      i === 0 ? 'refAsset' : `refAsset${i}`
    )
  }

  // Generate prefixes AFTER all pattern generation so all domains are included
  const prefixes = buildPrefixes(registry, [...prefixDomains])

  // Build the query
  return {
    sparql: assembleQuery(
      prefixes,
      selectVars,
      patterns,
      optionals,
      filters,
      getConfig().SPARQL_DEFAULT_LIMIT,
      hasReferenceJoin ? '?asset' : undefined
    ),
    trace: traces.length > 0 ? traces : undefined,
    droppedReferences: droppedReferences.length > 0 ? droppedReferences : undefined,
  }
}

/**
 * Compile a cross-domain query across every discovered asset type.
 *
 * Used when no specific domain is detected, or when domain ambiguity
 * exists. Filters are applied as OPTIONAL patterns since different
 * domains have different properties.
 *
 * The query enumerates concrete asset target classes via a SPARQL
 * `VALUES` clause derived from the discovered asset-domain set and
 * the registry, rather than relying on a superclass match with
 * implicit `rdfs:subClassOf*` inference. The store may not perform
 * inference and the sample data tags each asset only with its
 * concrete class, so a superclass-only form returned zero rows even
 * when assets were present. Enumerating the discovered target
 * classes makes the query work against any SPARQL store regardless
 * of inference support.
 *
 * Target classes are emitted as full `<IRI>` literals in the VALUES
 * clause so no per-domain `PREFIX` declarations are needed for them,
 * keeping the policy allowlist independent of which domains the
 * registry happens to discover.
 */
function compileCrossDomainQuery(
  slots: SearchSlots,
  registry: DomainRegistry,
  assetDomains: Set<string>,
  vocabIndex: CompilerVocab
): string {
  // The asset-class VALUES uses full IRIs so the cross-domain mode
  // doesn't pin the policy allowlist to specific ontology namespaces.
  // Prefixes are added on-demand based on discovered property paths.
  const usedPrefixes = new Set<string>()
  const prefixLines: string[] = [sparqlPrefix('rdfs'), sparqlPrefix('xsd'), sparqlPrefix('gx')]

  const patterns: string[] = []
  const filters: string[] = []
  const optionals: string[] = []
  const selectVars = ['?asset', '?name']

  // Build the VALUES list of every discovered asset target class as
  // full IRI literals. Sort for deterministic SPARQL output.
  const targetClassIris: string[] = []
  for (const domainName of [...assetDomains].sort()) {
    const desc = registry.domains.get(domainName)
    if (desc?.targetClassIri) targetClassIris.push(`<${desc.targetClassIri}>`)
  }

  // Base pattern — match any instance of a known asset target class.
  if (targetClassIris.length > 0) {
    patterns.push(`VALUES ?assetClass { ${targetClassIris.join(' ')} }`)
    patterns.push('?asset a ?assetClass ;')
    patterns.push('  rdfs:label ?name .')
  } else {
    patterns.push('VALUES ?assetClass {}')
    patterns.push('?asset a ?assetClass ;')
    patterns.push('  rdfs:label ?name .')
  }

  // Generic filter emission — task 21d folded location and license
  // into `slots.filters` keyed by their SHACL leaf local names. For
  // cross-domain queries (no specific domain selected) each filter
  // emits as an OPTIONAL chain walking whatever property path the
  // schema graph discovers for that leaf in any registered domain.
  // Filters that share a path prefix reuse intermediate variables;
  // filters with no discoverable path are skipped with a logger
  // warning.
  emitCrossDomainFilters(slots.filters, vocabIndex, registry, optionals, filters, selectVars, {
    usedPrefixes,
    prefixLines,
  })

  // Build the query
  const prefixes = prefixLines.join('\n')
  return assembleQuery(prefixes, selectVars, patterns, optionals, filters)
}

/**
 * Emit OPTIONAL chains for every filter in a cross-domain query.
 *
 * For each filter key the compiler picks the first registered domain
 * that has a discovered property path to a leaf with that local name
 * (sorted deterministically), then walks the path step by step. Multiple
 * filter keys that share a path prefix (e.g. country and city under
 * `hasGeoreference → hasProjectLocation`) reuse the intermediate
 * variables for a compact OPTIONAL block.
 *
 * Ontology-agnostic by design: no filter key is privileged, no
 * predicate name is literal, and the absence of any single path just
 * skips that filter without affecting the rest of the query.
 */
function emitCrossDomainFilters(
  filterMap: Record<string, string | string[]>,
  vocabIndex: CompilerVocab,
  registry: DomainRegistry,
  optionals: string[],
  filters: string[],
  selectVars: string[],
  prefixCtx: { usedPrefixes: Set<string>; prefixLines: string[] }
): void {
  // Resolve each filter key to a representative property path. Skip
  // keys with no path in any registered domain.
  type Entry = { key: string; value: string | string[]; path: PropertyPath }
  const resolved: Entry[] = []
  for (const [key, value] of Object.entries(filterMap)) {
    if (!isNonEmpty(value)) continue
    // Pick a path deterministically: lowest registry domain whose
    // discovered paths contain `<domain>:<key>`.
    let chosen: PropertyPath | undefined
    for (const [pathKey, path] of [...vocabIndex.paths].sort(([a], [b]) => a.localeCompare(b))) {
      if (pathKey.endsWith(`:${key}`)) {
        chosen = path
        break
      }
    }
    if (!chosen) {
      log.warn('Cross-domain filter skipped — no SHACL property path discovered for key', { key })
      continue
    }
    resolved.push({ key, value, path: chosen })
  }

  if (resolved.length === 0) return

  const ensurePrefix = (predicateIri: string): string => {
    const desc = findDomainForIri(predicateIri, registry)
    if (desc && !prefixCtx.usedPrefixes.has(desc.name)) {
      prefixCtx.usedPrefixes.add(desc.name)
      prefixCtx.prefixLines.push(`PREFIX ${desc.prefix}: <${desc.namespace}>`)
    }
    return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
  }

  // Bucket by path prefix (steps[0..n-2]) so filters that share an
  // intermediate chain reuse variables. Sorted prefix keys keep the
  // emitted SPARQL deterministic across compiler invocations.
  type Bucket = { referencePath: PropertyPath; entries: Entry[] }
  const buckets = new Map<string, Bucket>()
  for (const entry of resolved) {
    const prefixKey = entry.path.steps
      .slice(0, -1)
      .map((s) => s.predicate)
      .join('|')
    let bucket = buckets.get(prefixKey)
    if (!bucket) {
      bucket = { referencePath: entry.path, entries: [] }
      buckets.set(prefixKey, bucket)
    }
    bucket.entries.push(entry)
  }

  let bucketIdx = 0
  for (const [, bucket] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
    const path = bucket.referencePath
    const optionalLines: string[] = ['OPTIONAL {']
    let cursor = '?asset'
    // Walk all steps except the leaf; the leaf gets per-entry emission.
    for (let i = 0; i < path.steps.length - 1; i++) {
      const step = path.steps[i]!
      const intVar = i === path.steps.length - 2 ? `?_xd${bucketIdx}_end` : `?_xd${bucketIdx}_${i}`
      const pred = ensurePrefix(step.predicate)
      optionalLines.push(`    ${cursor} ${pred} ${intVar} .`)
      cursor = intVar
    }
    // Emit leaves and FILTERs.
    const sortedEntries = [...bucket.entries].sort((a, b) => a.key.localeCompare(b.key))
    for (const { key, value, path: leafPath } of sortedEntries) {
      const leafStep = leafPath.steps[leafPath.steps.length - 1]!
      const leafPred = ensurePrefix(leafStep.predicate)
      const v = `?${key}`
      optionalLines.push(`    ${cursor} ${leafPred} ${v} .`)
      if (leafPath.leafKind === 'literal') {
        addEnumFilter(optionalLines, filters, v, value)
      } else {
        addLocationFilter(filters, v, value)
      }
      selectVars.push(v)
    }
    optionalLines.push('  }')
    optionals.push(optionalLines.join('\n'))
    bucketIdx++
  }
}

/**
 * Compress a full predicate IRI to a `prefix:localName` form when the
 * predicate lives in the given domain's namespace. Falls back to an
 * angle-bracketed full IRI so cross-namespace predicates (e.g. the
 * `georeference:` chain) still parse.
 *
 * Used by 21b's path-driven emission to keep the wire output stable
 * with the previous literal-string emission (`hdmap:hasContent` etc.).
 */
function prefixedPredicate(predicateIri: string, domain: DomainDescriptor): string {
  if (predicateIri.startsWith(domain.namespace)) {
    return `${domain.prefix}:${predicateIri.slice(domain.namespace.length)}`
  }
  return `<${predicateIri}>`
}

/**
 * Find the DomainDescriptor whose namespace matches a predicate IRI.
 * Used to resolve cross-domain predicates (e.g., georeference:country)
 * to their prefix for SPARQL emission.
 */
function findDomainForIri(iri: string, registry: DomainRegistry): DomainDescriptor | undefined {
  let bestDesc: DomainDescriptor | undefined
  let bestLen = 0
  for (const desc of registry.domains.values()) {
    if (iri.startsWith(desc.namespace) && desc.namespace.length > bestLen) {
      bestDesc = desc
      bestLen = desc.namespace.length
    }
  }
  return bestDesc
}

/**
 * Pick the cross-domain reference chain to use when joining `parentDomain`
 * to `childDomain` (or to any child, if `childDomain` is undefined).
 *
 * Strategy:
 *   1. Prefer a `class:`-typed chain whose declared child class matches
 *      the requested domain — that's a SHACL-declared direct reference
 *      to exactly the child asset class, no extra type constraint needed.
 *   2. Otherwise fall back to the shortest `iri`-typed chain — the
 *      compiler will pair it with a `?ref a <ChildClass>` constraint.
 *
 * Returns `null` when the ontology declares no cross-reference path from
 * the parent. The caller skips reference emission rather than inventing
 * a literal predicate chain.
 */
/**
 * Pick a data-driven reference edge from `parentDomain` to `childDomain`,
 * preferring the shortest predicate path (fewer hops → cheaper JOIN) and
 * breaking ties by sample count (more data backing → more likely the
 * intended link). Returns null when the index has observed no
 * connection between the two domains.
 */
function pickDataReferenceEdge(
  index: ReferenceIndex,
  parentDomain: string,
  childDomain: string
): DataReferenceEdge | null {
  const edges = index.get(parentDomain)
  if (!edges) return null
  let best: DataReferenceEdge | null = null
  for (const e of edges) {
    if (e.targetDomain !== childDomain) continue
    if (
      !best ||
      e.predicatePath.length < best.predicatePath.length ||
      (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
    ) {
      best = e
    }
  }
  return best
}

/**
 * Fallback for {@link pickDataReferenceEdge}: when no exact target match
 * exists, pick any sibling edge from the same parent domain. The manifest
 * IRI pattern is generic — `hasManifest → hasReferencedArtifacts → iri`
 * can point to any asset type. If the data index observed the parent
 * reaching *some* other domain via that path, the same path is valid for
 * the requested target (the caller adds the type constraint separately).
 *
 * Returns the shortest, highest-sample sibling edge, or null if the parent
 * has no outgoing edges at all.
 */
function pickSiblingDataEdge(
  index: ReferenceIndex,
  parentDomain: string,
  excludeDomain?: string
): DataReferenceEdge | null {
  const edges = index.get(parentDomain)
  if (!edges) return null
  let best: DataReferenceEdge | null = null
  for (const e of edges) {
    if (excludeDomain && e.targetDomain === excludeDomain) continue
    if (
      !best ||
      e.predicatePath.length < best.predicatePath.length ||
      (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
    ) {
      best = e
    }
  }
  // If nothing remained after excluding, pick from ALL edges (the excluded
  // domain's path is still the right structural template).
  if (!best) {
    for (const e of edges) {
      if (
        !best ||
        e.predicatePath.length < best.predicatePath.length ||
        (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
      ) {
        best = e
      }
    }
  }
  return best
}

/**
 * Emit a SPARQL JOIN that walks the discovered predicate path step by
 * step, using fresh blank-node intermediates. The final step binds the
 * supplied `refVar` so the caller can constrain the child's type and
 * pull its label.
 *
 * Each predicate is emitted as a full `<IRI>` literal — that's the only
 * way to guarantee the query carries the exact path the index observed,
 * regardless of whether the prefix is registered.
 */
function emitDataReferencePath(
  edge: DataReferenceEdge,
  sourceVar: string,
  refVar: string,
  patterns: string[],
  registry: DomainRegistry,
  prefixDomains: Set<string>,
  traceSteps?: TraceabilityStep[],
  // Intermediate-variable prefix. Each reference in a multi-reference query
  // MUST use a distinct prefix, otherwise the second reference's chain reuses
  // the first's step variables and forces one manifest artifact to be two
  // different asset types (an unsatisfiable JOIN). Defaults to `ref` so the
  // single-reference output is unchanged.
  stepPrefix: string = 'ref'
): void {
  let cursor = sourceVar
  for (let i = 0; i < edge.predicatePath.length; i++) {
    const isLast = i === edge.predicatePath.length - 1
    const next = isLast ? refVar : `?${stepPrefix}_step_${i + 1}`
    const predicate = edge.predicatePath[i]!
    // Mirror `emitReferenceChainTriples`: prefer the registered prefix
    // form when the predicate's namespace resolves, fall back to a full
    // `<IRI>` literal otherwise. Keeps the emitted SPARQL readable and
    // pulls in the predicate's domain prefix so the final PREFIX block
    // lists every namespace the query actually uses.
    const desc = findDomainForIri(predicate, registry)
    const pred = desc ? prefixedPredicate(predicate, desc) : `<${predicate}>`
    if (desc) prefixDomains.add(desc.name)
    patterns.push(`${cursor} ${pred} ${next} .`)
    traceSteps?.push({ variable: next.slice(1), predicate })
    cursor = next
  }
}

function pickReferenceChain(
  vocabIndex: CompilerVocab,
  parentDomain: string,
  childDomain?: string
): ReferenceChain | null {
  const chains = vocabIndex.referenceChains.get(parentDomain)
  if (!chains || chains.length === 0) return null

  // Strategy 1: direct class-typed match.
  if (childDomain) {
    for (const chain of chains) {
      if (chain.kind === 'class' && chain.childDomain === childDomain) return chain
    }
  }

  // Strategy 2: shortest IRI-typed chain.
  for (const chain of chains) {
    if (chain.kind === 'iri') return chain
  }

  // Strategy 3: any class-typed chain (may resolve to a different child).
  return chains[0] ?? null
}

/**
 * Emit SPARQL triples for a cross-domain reference join driven by a
 * discovered {@link ReferenceChain}.
 *
 * Generates fresh intermediate variables for each step, binds the final
 * step's value to `boundVar`, and (for IRI-typed chains) adds a `?bound
 * a <childTargetClass>` constraint so the caller can filter to the
 * intended child asset domain.
 *
 * `idTag` disambiguates the intermediate variables when multiple
 * reference joins co-exist in the same query.
 */
function emitReferenceChainTriples(
  chain: ReferenceChain,
  assetVar: string,
  boundVar: string,
  childTargetClass: string | null,
  registry: DomainRegistry,
  idTag: string,
  patterns: string[],
  prefixDomains: Set<string>,
  traceSteps?: TraceabilityStep[]
): void {
  let cursor = assetVar
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i]!
    const isLast = i === chain.steps.length - 1
    const next = isLast ? boundVar : `?_${idTag}_${i}`
    const desc = findDomainForIri(step.predicate, registry)
    const pred = desc ? prefixedPredicate(step.predicate, desc) : `<${step.predicate}>`
    if (desc) prefixDomains.add(desc.name)
    patterns.push(`${cursor} ${pred} ${next} .`)
    traceSteps?.push({ variable: next.slice(1), predicate: step.predicate })
    cursor = next
  }
  if (childTargetClass && chain.kind === 'iri') {
    patterns.push(`${boundVar} a ${childTargetClass} .`)
  }
}

/**
 * Pick the step-N predicate to emit for the path of ANY property in the
 * given (domain, group) — used to discover the asset→spec and spec→group
 * predicates without hard-coding `hasDomainSpecification` / `has${Group}`.
 *
 * All filter/range properties classified into the same shape group share
 * the same step-N predicate (they live behind the same intermediate
 * shape in SHACL), so any of them is a valid representative. We pick
 * deterministically by sorting property names so the choice doesn't
 * shift across compiler invocations.
 */
function lookupStepPredicate(
  vocabIndex: CompilerVocab,
  domain: DomainDescriptor,
  candidatePropNames: string[],
  stepIdx: number
): string | null {
  for (const propName of [...candidatePropNames].sort()) {
    const path = vocabIndex.paths.get(`${domain.name}:${propName}`)
    if (!path) continue
    const step = path.steps[stepIdx]
    if (step) return prefixedPredicate(step.predicate, domain)
  }
  return null
}

/**
 * Threshold (in path steps) above which a filter property is treated as
 * "deep" and emitted via {@link emitDeepFilters} rather than the
 * shape-group machinery.
 *
 * The shape-group emission assumes the canonical 3-hop shape
 * `asset → spec → group → leaf` — exactly the depth produced by the
 * ENVITED-X domain-specification meta-model. Paths longer than that
 * (e.g. ENVITED-X location: `asset → spec → georef → loc → country`)
 * would route to a misclassified `hasGroup` predicate. Generic deep
 * emission walks the actual SHACL-discovered chain instead.
 */
const SHALLOW_PATH_MAX_STEPS = 3

/**
 * Build patterns for a single domain's filters within the discovered
 * SHACL graph structure. Returns the set of foreign domain names whose
 * prefixes were used in patterns (i.e., properties that belong to a
 * different domain than domainName).
 *
 * Filters split into two emission paths:
 *
 *   - **Shallow** (path ≤ 3 steps): emitted via the shape-group
 *     machinery — properties classified by their SHACL parent shape's
 *     `rdfs:subClassOf` superclass, then grouped into `asset → spec →
 *     hasGroup → leaf` triples that share intermediate variables.
 *   - **Deep** (path > 3 steps): emitted by walking the full
 *     SHACL-discovered chain via {@link emitDeepFilters}, grouped by
 *     shared path prefix so multiple deep filters under the same
 *     intermediate (e.g. `country` + `city`, both under `loc`) reuse
 *     the same chain emission.
 *
 * No ontology-specific field names are referenced. The compiler reads
 * which filters are "deep" purely from the SHACL graph at runtime
 * (task 21d).
 */
function buildDomainPatterns(
  domainName: string,
  domain: DomainDescriptor,
  domainFilters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  patterns: string[],
  filters: string[],
  optionals: string[],
  selectVars: Set<string>,
  vocabIndex: CompilerVocab,
  registry: Awaited<ReturnType<typeof buildDomainRegistry>>,
  assetVar: string,
  specVar: string
): Set<string> {
  const foreignDomains = new Set<string>()
  const allFilterEntries = Object.entries(domainFilters)
  const rangeEntries = Object.entries(ranges)

  // Partition filter entries by path depth. Deep filters skip the shape-
  // group classification entirely — they walk their own discovered chain.
  // Empty values (empty string, empty array) are dropped before partition
  // — a dangling triple with no FILTER would otherwise return zero rows
  // silently. This is the analogue of the `isNonEmpty` gate the previous
  // typed-location code applied per field.
  // Partition entries into three emission strategies, all driven by the
  // SHACL-discovered property path:
  //   - SHAPE-GROUP: a property classified into a discovered shape group
  //     (the ENVITED-X `asset → DomainSpecification → has${Group} → leaf`
  //     meta-model). Emitted by the shape-group machinery below.
  //   - DEEP: a path longer than the shape-group standard — walked from the
  //     spec variable via emitDeepFilters.
  //   - DIRECT: a property with NO shape group anywhere (a flat ontology's
  //     `asset → leaf`, or any non-meta-model schema). Walked straight from
  //     the asset variable — no fabricated `hasDomainSpecification` /
  //     `has${Group}` hops. This is what makes the compiler work on a schema
  //     that is not shaped like the ENVITED-X meta-model.
  // Empty values are dropped (a dangling triple with no FILTER returns zero
  // rows silently); a property with no discoverable path is left to the
  // shape-group fallback rather than walked.
  const shapeGroupFilterEntries: [string, string | string[]][] = []
  const deepFilterEntries: [string, string | string[], PropertyPath][] = []
  const directFilterEntries: [string, string | string[], PropertyPath][] = []
  for (const [propName, value] of allFilterEntries) {
    if (!isNonEmpty(value)) continue
    const path = vocabIndex.paths.get(`${domainName}:${propName}`)
    if (path && path.steps.length > SHALLOW_PATH_MAX_STEPS) {
      deepFilterEntries.push([propName, value, path])
    } else if (path && !vocabIndex.shapeGroupPropertyNames.has(propName)) {
      directFilterEntries.push([propName, value, path])
    } else {
      shapeGroupFilterEntries.push([propName, value])
    }
  }

  const shapeGroupRangeEntries: [string, { min?: number; max?: number }][] = []
  const directRangeEntries: [string, { min?: number; max?: number }, PropertyPath][] = []
  for (const [propName, range] of rangeEntries) {
    const path = vocabIndex.paths.get(`${domainName}:${propName}`)
    if (path && !vocabIndex.shapeGroupPropertyNames.has(propName)) {
      directRangeEntries.push([propName, range, path])
    } else {
      shapeGroupRangeEntries.push([propName, range])
    }
  }

  // Group shallow filter entries AND range entries by their classified
  // shape group, discovered from the SHACL graph at runtime (see
  // `queryPropertyShapeGroups`). There is no enumerated allow-list and no
  // privileged group — any shape group declared in the ontology is
  // handled uniformly, and each property's range is routed to the group
  // the SHACL graph actually puts it in. Pre-refactor the compiler had a
  // four-case switch over Content/Format/Quantity/DataSource that
  // silently dropped properties in other groups, and ranges were
  // unconditionally linked under `hasQuantity` regardless of where the
  // property actually lives.
  const filterPropsByGroup = new Map<string, [string, string | string[]][]>()
  const rangePropsByGroup = new Map<string, [string, { min?: number; max?: number }][]>()
  // Properties whose domain has no shape groups at all — emitted directly
  // on the asset variable (flat ontology pattern).
  const directFallbackFilters: [string, string | string[]][] = []
  const directFallbackRanges: [string, { min?: number; max?: number }][] = []

  for (const [propName, value] of shapeGroupFilterEntries) {
    const shape = classifyProperty(propName, domainName, vocabIndex)
    if (shape === null) {
      directFallbackFilters.push([propName, value])
      continue
    }
    let bucket = filterPropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      filterPropsByGroup.set(shape, bucket)
    }
    bucket.push([propName, value])
  }

  for (const [propName, range] of shapeGroupRangeEntries) {
    const shape = classifyProperty(propName, domainName, vocabIndex)
    if (shape === null) {
      directFallbackRanges.push([propName, range])
      continue
    }
    let bucket = rangePropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      rangePropsByGroup.set(shape, bucket)
    }
    bucket.push([propName, range])
  }

  // The asset → DomainSpecification hop is needed only by the shape-group and
  // deep strategies (both route through `specVar`); direct properties walk
  // straight from the asset, so a purely-flat domain emits no spec hop at all.
  const needsSpecHop =
    filterPropsByGroup.size > 0 || rangePropsByGroup.size > 0 || deepFilterEntries.length > 0
  const hasAnyEntry =
    needsSpecHop ||
    directFilterEntries.length > 0 ||
    directRangeEntries.length > 0 ||
    directFallbackFilters.length > 0 ||
    directFallbackRanges.length > 0

  if (!hasAnyEntry) return foreignDomains

  const suffix = assetVar === '?asset' ? '' : `_${domainName.replace(/-/g, '_')}`

  if (needsSpecHop) {
    // First hop: asset → DomainSpecification. The predicate is discovered
    // from any shape-group/deep property's path (every such property in this
    // domain shares the first step), falling back to a literal only for the
    // corner case of a domain whose discovery returned nothing.
    const candidatePropertyNames = [
      ...shapeGroupFilterEntries.map(([n]) => n),
      ...deepFilterEntries.map(([n]) => n),
      ...shapeGroupRangeEntries.map(([n]) => n),
    ]
    const assetToSpecPredicate =
      lookupStepPredicate(vocabIndex, domain, candidatePropertyNames, 0) ??
      `${domain.prefix}:hasDomainSpecification`
    patterns.push(`${assetVar} ${assetToSpecPredicate} ${specVar} .`)
  }

  const groupsToEmit = new Set<string>([...filterPropsByGroup.keys(), ...rangePropsByGroup.keys()])

  for (const group of [...groupsToEmit].sort()) {
    // Pre-resolve all property prefixes and sub-group by prefix.
    // Properties from different ontology domains may live on separate RDF
    // nodes even when they share the same shape group (e.g., hdmap:Content
    // and openlabel_v2:Odd are both reachable via hasContent). Binding them
    // to the same SPARQL variable would produce an unsatisfiable pattern.
    // Sub-grouping by prefix ensures each type-disjoint node gets its own
    // variable and its own `hasGroup` triple.
    const prefixBuckets = new Map<
      string,
      {
        foreignDomain: string | null
        filters: [string, string | string[]][]
        ranges: [string, { min?: number; max?: number }][]
      }
    >()

    const ensureBucket = (prefix: string, fd: string | null) => {
      let b = prefixBuckets.get(prefix)
      if (!b) {
        b = { foreignDomain: fd, filters: [], ranges: [] }
        prefixBuckets.set(prefix, b)
      }
      return b
    }

    for (const [propName, value] of filterPropsByGroup.get(group) ?? []) {
      const { prefix: pp, foreignDomain: fd } = resolvePropertyPrefix(
        propName,
        domainName,
        vocabIndex,
        registry
      )
      ensureBucket(pp, fd).filters.push([propName, value])
    }

    for (const [propName, range] of rangePropsByGroup.get(group) ?? []) {
      const { prefix: pp, foreignDomain: fd } = resolvePropertyPrefix(
        propName,
        domainName,
        vocabIndex,
        registry
      )
      ensureBucket(pp, fd).ranges.push([propName, range])
    }

    // Emit each prefix bucket with its own hasGroup binding variable.
    for (const [propPrefix, bucket] of [...prefixBuckets].sort(([a], [b]) => a.localeCompare(b))) {
      // Foreign-domain properties get a prefix-qualified variable name to
      // avoid colliding with the native domain's group variable.
      const pfxTag = bucket.foreignDomain ? `_${propPrefix.replace(/-/g, '_')}` : ''
      const groupVar = `?${groupVariableName(group)}${pfxTag}${suffix}`

      // Second hop: DomainSpecification → group sub-resource. Use
      // path-discovery (lookupStepPredicate) for native-domain properties;
      // fall back to conventional `${prefix}:has${Group}` for foreign
      // domains or when discovery hasn't been run.
      const bucketPropNames = [...bucket.filters.map(([n]) => n), ...bucket.ranges.map(([n]) => n)]
      const specToGroupPredicate = bucket.foreignDomain
        ? `${propPrefix}:${groupPredicate(group)}`
        : (lookupStepPredicate(vocabIndex, domain, bucketPropNames, 1) ??
          `${domain.prefix}:${groupPredicate(group)}`)
      patterns.push(`${specVar} ${specToGroupPredicate} ${groupVar} .`)

      if (bucket.foreignDomain) foreignDomains.add(bucket.foreignDomain)

      // Filter properties in this bucket.
      for (const [propName, value] of bucket.filters) {
        const varName = `?${propName}${suffix}`
        patterns.push(`${groupVar} ${propPrefix}:${propName} ${varName} .`)
        addEnumFilter(patterns, filters, varName, value)
        selectVars.add(varName)
      }

      // Range properties in this bucket. Range2D properties (detected from
      // SHACL via `sh:node → Range2DShape`) use nested `min`/`max`; simple
      // numeric properties are filtered directly.
      for (const [propName, range] of bucket.ranges) {
        const range2D = vocabIndex.range2DProperties.get(propName)
        if (range2D) {
          const rangeNode = `?${propName}Range${suffix}`
          patterns.push(`${groupVar} ${propPrefix}:${propName} ${rangeNode} .`)
          // Emit the SHACL-discovered min/max sub-predicates (prefix-compressed
          // when they live in a known namespace; full IRI otherwise). The
          // bound-overlap semantics are unchanged: a user `min` constrains the
          // interval's upper predicate, and vice-versa.
          const minDesc = findDomainForIri(range2D.minPredicate, registry)
          const maxDesc = findDomainForIri(range2D.maxPredicate, registry)
          const minPred = minDesc
            ? prefixedPredicate(range2D.minPredicate, minDesc)
            : `<${range2D.minPredicate}>`
          const maxPred = maxDesc
            ? prefixedPredicate(range2D.maxPredicate, maxDesc)
            : `<${range2D.maxPredicate}>`
          if (minDesc) foreignDomains.add(minDesc.name)
          if (maxDesc) foreignDomains.add(maxDesc.name)
          if (range.min !== undefined) {
            const maxVar = `?${propName}Max${suffix}`
            patterns.push(`${rangeNode} ${maxPred} ${maxVar} .`)
            filters.push(`FILTER(xsd:float(${maxVar}) >= ${range.min})`)
            selectVars.add(maxVar)
          }
          if (range.max !== undefined) {
            const minVar = `?${propName}Min${suffix}`
            patterns.push(`${rangeNode} ${minPred} ${minVar} .`)
            filters.push(`FILTER(xsd:float(${minVar}) <= ${range.max})`)
            selectVars.add(minVar)
          }
        } else {
          const varName = `?${propName}${suffix}`
          patterns.push(`${groupVar} ${propPrefix}:${propName} ${varName} .`)
          selectVars.add(varName)
          if (range.min !== undefined) {
            filters.push(`FILTER(xsd:float(${varName}) >= ${range.min})`)
          }
          if (range.max !== undefined) {
            filters.push(`FILTER(xsd:float(${varName}) <= ${range.max})`)
          }
        }
      }
    }
  }

  // Deep filters — paths longer than the shape-group standard. Emit
  // by walking each filter's discovered chain. Filters sharing a path
  // prefix (e.g. ENVITED-X country + city, both under
  // hasGeoreference → hasProjectLocation) reuse the same intermediate
  // variables for a compact query.
  if (deepFilterEntries.length > 0) {
    emitDeepFilters(
      domainName,
      domain,
      deepFilterEntries,
      specVar,
      suffix,
      patterns,
      filters,
      selectVars,
      foreignDomains,
      registry
    )
  }

  // Direct properties: no shape group anywhere, so walk each one's discovered
  // path straight from the asset variable (flat / non-meta-model schemas).
  if (directFilterEntries.length > 0 || directRangeEntries.length > 0) {
    emitDirectPathFilters(
      domainName,
      directFilterEntries,
      directRangeEntries,
      assetVar,
      suffix,
      patterns,
      filters,
      selectVars,
      foreignDomains,
      registry,
      vocabIndex
    )
  }

  // Emit direct-fallback properties: those with no discovered path AND no
  // shape group (flat ontology, unknown property). Walk directly from the
  // asset using the domain prefix convention: `prefix:propName`.
  if (directFallbackFilters.length > 0 || directFallbackRanges.length > 0) {
    for (const [propName, value] of directFallbackFilters) {
      const varName = `?${propName}${suffix}`
      patterns.push(`${assetVar} ${domain.prefix}:${propName} ${varName} .`)
      addEnumFilter(patterns, filters, varName, value)
      selectVars.add(varName)
    }
    for (const [propName, range] of directFallbackRanges) {
      const varName = `?${propName}${suffix}`
      patterns.push(`${assetVar} ${domain.prefix}:${propName} ${varName} .`)
      if (range.min !== undefined) {
        filters.push(`FILTER(${varName} >= ${range.min})`)
      }
      if (range.max !== undefined) {
        filters.push(`FILTER(${varName} <= ${range.max})`)
      }
      selectVars.add(varName)
    }
  }

  return foreignDomains
}

/**
 * Phase 3: Merged multi-path UNION emission.
 *
 * When multiple multi-path entries (e.g., lateral + beginsAtSeconds) have
 * alternative paths that share the same first-hop predicate from the asset,
 * they are CO-LOCATED: emitted in a single UNION branch where all constraints
 * bind through the same intermediate variable. This gives correct co-location
 * semantics ("find a PHASE where lateral=KeepLane AND begins>=5") rather than
 * the weaker cross-product ("find assets where SOME phase has KeepLane AND
 * SOME interval >= 5").
 *
 * Entries whose paths don't overlap with any other entry fall back to
 * independent UNION emission (Phase 2 behaviour).
 */
function emitMergedMultiPathUnion(
  multiPathEntries: (
    | { kind: 'filter'; name: string; value: string | string[]; path: PropertyPath }
    | { kind: 'range'; name: string; range: { min?: number; max?: number }; path: PropertyPath }
  )[],
  domainName: string,
  assetVar: string,
  suffix: string,
  patterns: string[],
  filters: string[],
  selectVars: Set<string>,
  vocabIndex: CompilerVocab,
  emitPredicate: (iri: string) => string
): void {
  if (multiPathEntries.length === 0) return

  type Entry = (typeof multiPathEntries)[number]

  // For each entry, build a map: firstStepPredicate → altPath[]
  type PathByFirstHop = { entry: Entry; altPath: PropertyPath }
  const firstHopIndex = new Map<string, PathByFirstHop[]>()
  for (const entry of multiPathEntries) {
    const altPaths = vocabIndex.allPaths.get(`${domainName}:${entry.name}`) ?? [entry.path]
    for (const altPath of altPaths) {
      if (altPath.steps.length < 2) continue // direct leaf, no intermediate
      const firstPred = altPath.steps[0]!.predicate
      const group = firstHopIndex.get(firstPred) ?? []
      group.push({ entry, altPath })
      firstHopIndex.set(firstPred, group)
    }
  }

  // Identify which first-hops have entries from MULTIPLE distinct properties
  // (those are the merge candidates).
  const mergeableHops = new Map<string, PathByFirstHop[]>()
  const standaloneHops = new Map<string, PathByFirstHop[]>()
  for (const [hop, items] of firstHopIndex) {
    const distinctProps = new Set(items.map((i) => i.entry.name))
    if (distinctProps.size > 1) {
      mergeableHops.set(hop, items)
    } else {
      standaloneHops.set(hop, items)
    }
  }

  // Track which entries have been fully handled by merge groups
  const mergedEntryNames = new Set<string>()

  // Emit merged UNION: one block whose branches correspond to the shared
  // first-hop predicates. Each branch walks all entries' chains from the
  // shared intermediate.
  if (mergeableHops.size > 0) {
    // Register leaf variables for all entries participating in the merge
    const participatingEntries = new Map<string, Entry>()
    for (const [, items] of mergeableHops) {
      for (const { entry } of items) {
        participatingEntries.set(entry.name, entry)
        mergedEntryNames.add(entry.name)
      }
    }
    for (const entry of participatingEntries.values()) {
      selectVars.add(`?${entry.name}${suffix}`)
    }

    // Build UNION branches — one per mergeable first-hop predicate
    const branches: string[] = []
    for (const [, items] of [...mergeableHops].sort(([a], [b]) => a.localeCompare(b))) {
      const branchLines: string[] = []
      // Walk the shared first hop (all items agree on this predicate)
      const firstStep = items[0]!.altPath.steps[0]!
      const sharedIntVar = `?_mp0${suffix}`
      branchLines.push(`${assetVar} ${emitPredicate(firstStep.predicate)} ${sharedIntVar} .`)

      // For each unique entry in this branch, walk remaining steps to its leaf
      const seenProps = new Set<string>()
      for (const { entry, altPath } of items) {
        if (seenProps.has(entry.name)) continue
        seenProps.add(entry.name)
        const leafVarName = `?${entry.name}${suffix}`
        let cursor = sharedIntVar
        // Walk steps[1..n-2] (remaining intermediates after the shared first hop)
        for (let i = 1; i < altPath.steps.length - 1; i++) {
          const step = altPath.steps[i]!
          const intVar = `?_mp${i}_${entry.name}${suffix}`
          branchLines.push(`${cursor} ${emitPredicate(step.predicate)} ${intVar} .`)
          cursor = intVar
        }
        // Walk final leaf step
        const leafStep = altPath.steps[altPath.steps.length - 1]!
        branchLines.push(`${cursor} ${emitPredicate(leafStep.predicate)} ${leafVarName} .`)
      }
      branches.push(`{ ${branchLines.join('\n    ')} }`)
    }
    patterns.push(branches.join('\n  UNION\n  '))

    // Emit FILTERs for all participating entries
    for (const entry of participatingEntries.values()) {
      const leafVarName = `?${entry.name}${suffix}`
      if (entry.kind === 'filter') {
        if (entry.path.leafKind === 'literal') {
          addEnumFilter(patterns, filters, leafVarName, entry.value)
        } else {
          addLocationFilter(filters, leafVarName, entry.value)
        }
      } else {
        if (entry.range.min !== undefined) {
          filters.push(`FILTER(xsd:float(${leafVarName}) >= ${entry.range.min})`)
        }
        if (entry.range.max !== undefined) {
          filters.push(`FILTER(xsd:float(${leafVarName}) <= ${entry.range.max})`)
        }
      }
    }
  }

  // Emit standalone entries (not merged with anything) as independent UNIONs
  for (const entry of multiPathEntries) {
    if (mergedEntryNames.has(entry.name)) continue
    const altPaths = vocabIndex.allPaths.get(`${domainName}:${entry.name}`) ?? [entry.path]
    const leafVarName = `?${entry.name}${suffix}`
    selectVars.add(leafVarName)

    const branches: string[] = []
    for (let pathIdx = 0; pathIdx < altPaths.length; pathIdx++) {
      const altPath = altPaths[pathIdx]!
      const branchLines: string[] = []
      let cursor = assetVar
      for (let i = 0; i < altPath.steps.length - 1; i++) {
        const step = altPath.steps[i]!
        const intVar = `?_up${pathIdx}_${i}${suffix}`
        branchLines.push(`${cursor} ${emitPredicate(step.predicate)} ${intVar} .`)
        cursor = intVar
      }
      const leafStep = altPath.steps[altPath.steps.length - 1]!
      branchLines.push(`${cursor} ${emitPredicate(leafStep.predicate)} ${leafVarName} .`)
      branches.push(`{ ${branchLines.join('\n    ')} }`)
    }
    patterns.push(branches.join('\n  UNION\n  '))

    if (entry.kind === 'filter') {
      if (entry.path.leafKind === 'literal') {
        addEnumFilter(patterns, filters, leafVarName, entry.value)
      } else {
        addLocationFilter(filters, leafVarName, entry.value)
      }
    } else {
      if (entry.range.min !== undefined) {
        filters.push(`FILTER(xsd:float(${leafVarName}) >= ${entry.range.min})`)
      }
      if (entry.range.max !== undefined) {
        filters.push(`FILTER(xsd:float(${leafVarName}) <= ${entry.range.max})`)
      }
    }
  }
}

/**
 * Emit MANDATORY patterns for "direct" properties — those with a discovered
 * path but NO shape group anywhere (a flat ontology's `asset → leaf`, or any
 * schema not shaped like the ENVITED-X DomainSpecification meta-model).
 *
 * Each property's discovered path is walked straight from the asset variable;
 * properties that share a path prefix reuse the intermediate variables for a
 * compact query. Every emitted predicate comes from a discovered PathStep —
 * no `hasDomainSpecification` / `has${Group}` predicate is fabricated. This is
 * the emission path that makes the compiler genuinely ontology-agnostic; the
 * shape-group machinery above stays the path for ENVITED-X-shaped domains so
 * their output (and the determinism snapshots) are unchanged.
 */
function emitDirectPathFilters(
  domainName: string,
  filterEntries: [string, string | string[], PropertyPath][],
  rangeEntries: [string, { min?: number; max?: number }, PropertyPath][],
  assetVar: string,
  suffix: string,
  patterns: string[],
  filters: string[],
  selectVars: Set<string>,
  foreignDomains: Set<string>,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): void {
  type Entry =
    | { kind: 'filter'; name: string; value: string | string[]; path: PropertyPath }
    | { kind: 'range'; name: string; range: { min?: number; max?: number }; path: PropertyPath }
  const all: Entry[] = [
    ...filterEntries.map(([name, value, path]): Entry => ({ kind: 'filter', name, value, path })),
    ...rangeEntries.map(([name, range, path]): Entry => ({ kind: 'range', name, range, path })),
  ]

  // Compress a predicate IRI to prefix form, registering any foreign domain.
  const emitPredicate = (predicateIri: string): string => {
    const desc = findDomainForIri(predicateIri, registry)
    if (desc && desc.name !== domainName) foreignDomains.add(desc.name)
    return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
  }

  // Phase 2+3: for each entry, check if allPaths has multiple routes.
  // Phase 3 MERGES entries that share intermediate steps into a single
  // UNION (avoids cross-product duplicates and ensures co-location
  // semantics: constraints bind through the SAME intermediate node).
  const singlePathEntries: Entry[] = []
  const multiPathEntries: Entry[] = []
  for (const entry of all) {
    const altPaths = vocabIndex.allPaths.get(`${domainName}:${entry.name}`)
    if (altPaths && altPaths.length > 1) {
      multiPathEntries.push(entry)
    } else {
      singlePathEntries.push(entry)
    }
  }

  // Phase 3: Merge multi-path entries that share the same first-hop
  // predicate into a single UNION block. This ensures co-location:
  // "find a phase where lateral=KeepLane AND begins>=5" rather than
  // "find assets where SOME phase has KeepLane AND SOME interval>=5".
  emitMergedMultiPathUnion(
    multiPathEntries,
    domainName,
    assetVar,
    suffix,
    patterns,
    filters,
    selectVars,
    vocabIndex,
    emitPredicate
  )

  // Emit single-path entries normally (original bucket-by-prefix logic).
  if (singlePathEntries.length === 0) return

  // Bucket by shared path-prefix (every step except the leaf) so siblings
  // reuse intermediates. Sorted keys keep the emitted SPARQL deterministic.
  const buckets = new Map<string, { referencePath: PropertyPath; entries: Entry[] }>()
  for (const entry of singlePathEntries) {
    const prefixKey = entry.path.steps
      .slice(0, -1)
      .map((s) => s.predicate)
      .join('|')
    let bucket = buckets.get(prefixKey)
    if (!bucket) {
      bucket = { referencePath: entry.path, entries: [] }
      buckets.set(prefixKey, bucket)
    }
    bucket.entries.push(entry)
  }

  let bucketIdx = 0
  for (const [, bucket] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
    const refPath = bucket.referencePath
    // Walk steps[0..n-2] from the asset, binding shared intermediates.
    let cursor = assetVar
    for (let i = 0; i < refPath.steps.length - 1; i++) {
      const step = refPath.steps[i]!
      const intVar = `?_dp${bucketIdx}_${i}${suffix}`
      patterns.push(`${cursor} ${emitPredicate(step.predicate)} ${intVar} .`)
      cursor = intVar
    }

    for (const entry of [...bucket.entries].sort((a, b) => a.name.localeCompare(b.name))) {
      const leafStep = entry.path.steps[entry.path.steps.length - 1]!
      const leafPred = emitPredicate(leafStep.predicate)
      if (entry.kind === 'filter') {
        const v = `?${entry.name}${suffix}`
        patterns.push(`${cursor} ${leafPred} ${v} .`)
        if (entry.path.leafKind === 'literal') {
          addEnumFilter(patterns, filters, v, entry.value)
        } else {
          addLocationFilter(filters, v, entry.value)
        }
        selectVars.add(v)
      } else {
        const range2D = vocabIndex.range2DProperties.get(entry.name)
        if (range2D) {
          const rangeNode = `?${entry.name}Range${suffix}`
          patterns.push(`${cursor} ${leafPred} ${rangeNode} .`)
          const minPred = emitPredicate(range2D.minPredicate)
          const maxPred = emitPredicate(range2D.maxPredicate)
          if (entry.range.min !== undefined) {
            const maxVar = `?${entry.name}Max${suffix}`
            patterns.push(`${rangeNode} ${maxPred} ${maxVar} .`)
            filters.push(`FILTER(xsd:float(${maxVar}) >= ${entry.range.min})`)
            selectVars.add(maxVar)
          }
          if (entry.range.max !== undefined) {
            const minVar = `?${entry.name}Min${suffix}`
            patterns.push(`${rangeNode} ${minPred} ${minVar} .`)
            filters.push(`FILTER(xsd:float(${minVar}) <= ${entry.range.max})`)
            selectVars.add(minVar)
          }
        } else {
          const v = `?${entry.name}${suffix}`
          patterns.push(`${cursor} ${leafPred} ${v} .`)
          selectVars.add(v)
          if (entry.range.min !== undefined) {
            filters.push(`FILTER(xsd:float(${v}) >= ${entry.range.min})`)
          }
          if (entry.range.max !== undefined) {
            filters.push(`FILTER(xsd:float(${v}) <= ${entry.range.max})`)
          }
        }
      }
    }
    bucketIdx++
  }
}

/**
 * Emit a deep-chain filter group. Each entry's discovered path has
 * `> SHALLOW_PATH_MAX_STEPS` steps; emission walks every step from
 * `?specVar` to the leaf, sharing intermediate variables whenever
 * multiple entries agree on a path prefix.
 *
 * Generic over which properties qualify as "deep" — driven entirely by
 * the SHACL property-path discovery, with no hard-coded field names.
 *
 * Variable naming: intermediates use `?_dN_${suffix}` where N is the
 * depth from `specVar` (which is itself step 1's source — the
 * compiler has already emitted the asset → spec hop). Leaves use the
 * filter property's local name, suffixed for cross-domain queries.
 */
function emitDeepFilters(
  domainName: string,
  domain: DomainDescriptor,
  entries: [string, string | string[], PropertyPath][],
  specVar: string,
  suffix: string,
  patterns: string[],
  filters: string[],
  selectVars: Set<string>,
  foreignDomains: Set<string>,
  registry: DomainRegistry
): void {
  // Bucket entries by their full path-prefix (everything except the
  // leaf). Sharing a prefix means sharing intermediate variables.
  type Bucket = {
    referencePath: PropertyPath
    entries: [string, string | string[], PropertyPath][]
  }
  const buckets = new Map<string, Bucket>()
  for (const entry of entries) {
    const path = entry[2]
    const prefixKey = path.steps
      .slice(0, -1)
      .map((s) => s.predicate)
      .join('|')
    let bucket = buckets.get(prefixKey)
    if (!bucket) {
      bucket = { referencePath: path, entries: [] }
      buckets.set(prefixKey, bucket)
    }
    bucket.entries.push(entry)
  }

  let bucketIdx = 0
  // Sort by prefix key for deterministic SPARQL output.
  for (const [, bucket] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
    const referencePath = bucket.referencePath
    // Walk steps[1..n-2] — step 0 is the asset → spec edge already
    // emitted by buildDomainPatterns, and step n-1 (the leaf) gets a
    // per-entry emission below.
    let cursor = specVar
    for (let i = 1; i < referencePath.steps.length - 1; i++) {
      const step = referencePath.steps[i]!
      const intVar = `?_d${bucketIdx}_${i}${suffix}`
      const desc = findDomainForIri(step.predicate, registry)
      const pred = desc ? prefixedPredicate(step.predicate, desc) : `<${step.predicate}>`
      if (desc && desc.name !== domainName) foreignDomains.add(desc.name)
      patterns.push(`${cursor} ${pred} ${intVar} .`)
      cursor = intVar
    }
    // Emit leaf for each entry under this shared chain. Sort for
    // determinism so the compiler emits the same SPARQL across
    // invocations regardless of the input map's iteration order.
    const sortedEntries = [...bucket.entries].sort((a, b) => a[0].localeCompare(b[0]))
    for (const [propName, value, path] of sortedEntries) {
      const leafStep = path.steps[path.steps.length - 1]!
      const leafDomain = findDomainForIri(leafStep.predicate, registry)
      const leafPredicate = leafDomain
        ? prefixedPredicate(leafStep.predicate, leafDomain)
        : `<${leafStep.predicate}>`
      if (leafDomain && leafDomain.name !== domainName) foreignDomains.add(leafDomain.name)
      const v = `?${propName}${suffix}`
      patterns.push(`${cursor} ${leafPredicate} ${v} .`)
      // Use the filter helper that matches the leaf's value kind.
      // `class:` leaves are IRI-typed and want STR/LCASE matching;
      // `iri` leaves likewise. Literal leaves want exact equality.
      if (path.leafKind === 'literal') {
        addEnumFilter(patterns, filters, v, value)
      } else {
        addLocationFilter(filters, v, value)
      }
      selectVars.add(v)
    }
    bucketIdx++
  }
  // The reference to `domain` is intentional for future extension —
  // currently only the leaf domain matters, but `domain` is the
  // primary asset domain context for any cross-domain warnings.
  void domain
}

/**
 * Partition filters into per-domain groups based on ontology graph.
 * Uses the ontology's property definitions to determine which domain each filter belongs to.
 * Handles properties that exist in multiple domains by checking against detected domains.
 */
function partitionFiltersByDomain(
  filters: Record<string, string | string[]>,
  detectedDomains: string[],
  vocabIndex: CompilerVocab
): Record<string, Record<string, string | string[]>> {
  const result: Record<string, Record<string, string | string[]>> = {}

  // Defense-in-depth: drop any filter key the schema doesn't know about.
  // The slot validator should already have caught these and emitted a gap;
  // the compiler is the last gate before SPARQL so a non-existent property
  // never produces a `?asset domain:fakeProp ?x` triple that would match
  // zero results without explanation.
  const known: Record<string, string | string[]> = {}
  for (const [propName, value] of Object.entries(filters)) {
    if (isKnownProperty(propName, vocabIndex)) known[propName] = value
  }

  // Single domain — all known filters belong to it
  if (detectedDomains.length === 1) {
    result[detectedDomains[0]!] = { ...known }
    return result
  }

  // Multi-domain: find which detected domain owns each property. A
  // property may exist in MULTIPLE domains (e.g., roadTypes in both
  // hdmap and ositrace). Assign it to ALL matching domains so UNION
  // queries work. Deep-chain leaves (which appear in `vocabIndex.paths`
  // but not in `vocabIndex.properties` because their owning shape's
  // target class lives in a different domain) are matched via the path
  // index so they reach the compiler.
  for (const [propName, value] of Object.entries(known)) {
    const owningDomains = ownersOf(propName, vocabIndex)
    const matchingDomains = detectedDomains.filter((d) => owningDomains.has(d))
    for (const matchingDomain of matchingDomains) {
      if (!result[matchingDomain]) result[matchingDomain] = {}
      result[matchingDomain]![propName] = value
    }
    // If property is not in any detected domain, drop it — the slot
    // validator should have already emitted a gap upstream.
  }

  return result
}

/**
 * Domains that "own" a given property local name — i.e. the set of
 * detected-domain candidates a multi-domain query partition should
 * consider. Combines the `queryPropertyDomains` index with the
 * property-path BFS so deep-chain leaves (country, license, …) are
 * matched the same way as shallow leaves (roadTypes, …).
 */
function ownersOf(propName: string, vocabIndex: CompilerVocab): Set<string> {
  const owners = new Set<string>()
  const propInfo = vocabIndex.properties.get(propName)
  if (propInfo) {
    for (const d of propInfo.domains) owners.add(d)
  }
  for (const key of vocabIndex.paths.keys()) {
    const [pathDomain, pathProp] = key.split(':')
    if (pathProp === propName && pathDomain) owners.add(pathDomain)
  }
  return owners
}

/**
 * Partition ranges into per-domain groups based on ontology graph.
 * Similar to partitionFiltersByDomain but for numeric range properties.
 */
function partitionRangesByDomain(
  ranges: Record<string, { min?: number; max?: number }>,
  detectedDomains: string[],
  vocabIndex: CompilerVocab
): Record<string, Record<string, { min?: number; max?: number }>> {
  const result: Record<string, Record<string, { min?: number; max?: number }>> = {}

  // Defense-in-depth: drop any range key the schema doesn't know about.
  // Same reasoning as partitionFiltersByDomain — without this gate the LLM
  // can invent numeric properties (e.g. `numberLanes`) that compile into
  // a dead `?qty domain:invented ?x` triple and return 0 results silently.
  const known: Record<string, { min?: number; max?: number }> = {}
  for (const [propName, range] of Object.entries(ranges)) {
    if (isKnownProperty(propName, vocabIndex)) known[propName] = range
  }

  // Single domain — all known ranges belong to it
  if (detectedDomains.length === 1) {
    result[detectedDomains[0]!] = { ...known }
    return result
  }

  // Multi-domain: find which detected domain owns each property. Mirrors
  // partitionFiltersByDomain (including the deep-chain path lookup).
  for (const [propName, range] of Object.entries(known)) {
    const owningDomains = ownersOf(propName, vocabIndex)
    const matchingDomains = detectedDomains.filter((d) => owningDomains.has(d))
    for (const matchingDomain of matchingDomains) {
      if (!result[matchingDomain]) result[matchingDomain] = {}
      result[matchingDomain]![propName] = range
    }
    // If property is not in any detected domain, drop it — the slot
    // validator should have already emitted a gap upstream.
  }

  return result
}

/**
 * Determine the primary domain — the composite one that references others.
 * E.g., if we have both 'scenario' and 'hdmap' filters, scenario is primary
 * because scenarios reference hdmaps.
 */
async function resolvePrimaryDomain(
  detectedDomains: string[],
  filtersByDomain: Record<string, Record<string, string | string[]>>
): Promise<string> {
  const allDomains = new Set([...detectedDomains, ...Object.keys(filtersByDomain)])

  // A single domain is always its own primary — skip the (global) reference
  // index entirely so single-domain compilation has no cross-domain dependency.
  if (allDomains.size === 1) return detectedDomains[0] ?? [...allDomains][0]!

  const domainRefs = await getDomainReferences()

  // Check if any domain references others that are present
  for (const [parent, children] of domainRefs.entries()) {
    if (allDomains.has(parent)) {
      for (const child of children) {
        if (allDomains.has(child)) {
          return parent
        }
      }
    }
  }

  // Otherwise pick the first detected domain (LLM should have chosen correctly)
  if (detectedDomains.length === 0) {
    throw new CompileError('No domains detected - cannot compile query')
  }
  return detectedDomains[0]!
}

/**
 * Build the PREFIX block for a set of domains.
 * Uses the registry to look up namespaces — no hardcoded domain-specific URIs.
 */
function buildPrefixes(
  registry: Awaited<ReturnType<typeof buildDomainRegistry>>,
  domains: string[]
): string {
  const prefixSet = new Set<string>()

  // W3C / community-standard prefixes (specification-defined). Always
  // emitted regardless of which domain predicates appear in the query,
  // because the standard prefixes are also referenced by the policy
  // gate's IRI allowlist.
  prefixSet.add(sparqlPrefix('rdfs'))
  prefixSet.add(sparqlPrefix('xsd'))
  prefixSet.add(sparqlPrefix('gx'))

  // Domain-specific prefixes — every domain whose namespace appears in
  // an emitted predicate. The caller accumulates this set as the
  // compiler walks discovered chains and emits patterns, so prefixes
  // for shared or "support" domains (cross-domain join chains, location
  // sub-shapes, etc.) get added the same way as the asset domain's own.
  // No domain name is hard-coded here.
  for (const domainName of domains) {
    const domain = registry.domains.get(domainName) ?? registry.resolveByIriDomain(domainName)
    if (domain) {
      prefixSet.add(`PREFIX ${domain.prefix}: <${domain.namespace}>`)
    }
  }

  return [...prefixSet].join('\n')
}

/**
 * Classify a property into its parent SHACL shape group.
 *
 * Uses graph-queried shape group data from rdfs:subClassOf hierarchy:
 * Shape → sh:targetClass → C, C rdfs:subClassOf base:Content → "Content"
 *
 * Falls back to the first available shape group for the domain, or "Content"
 * as a last resort. Logs a warning when the fallback is used so that missing
 * shape group data is surfaced during development.
 */
function classifyProperty(
  propName: string,
  domainName: string,
  vocabIndex: CompilerVocab
): string | null {
  const shapeGroup = vocabIndex.shapeGroups.get(`${propName}:${domainName}`)
  if (shapeGroup) return shapeGroup

  // Fallback: find any shape group used by this domain.
  for (const [key, group] of vocabIndex.shapeGroups) {
    if (key.endsWith(`:${domainName}`)) {
      log.warn('No shape group found for property — falling back to first group for domain', {
        property: propName,
        domain: domainName,
        fallback: group,
      })
      return group
    }
  }

  // No shape groups exist for this domain at all — the ontology uses a flat
  // structure where properties live directly on the asset class (no
  // DomainSpecification→Content hierarchy). Return null so the caller can
  // emit the property as a direct triple on the asset variable.
  log.debug('No shape groups for domain — property will be emitted as direct', {
    property: propName,
    domain: domainName,
  })
  return null
}

/**
 * Convert a SHACL shape-group localName into the SPARQL variable name that
 * holds the linked DomainSpecification sub-resource. The convention is
 * lower-camelCase of the localName: `Content → content`, `DataSource →
 * dataSource`, `Quantity → quantity`. Both `?fmt` (old `?fmt` for Format)
 * and `?ds` (old `?ds` for DataSource) used hand-picked abbreviations the
 * are intentionally unabbreviated; the unified rule reads as well or better and
 * works for any future group.
 */
function groupVariableName(group: string): string {
  if (group.length === 0) return 'group'
  return group[0]!.toLowerCase() + group.slice(1)
}

/**
 * The `hasGroup` predicate linking the DomainSpecification to a shape's
 * sub-resource: `Content → hasContent`, `Quantity → hasQuantity`, …
 *
 * The ENVITED-X SHACL convention is consistent across every domain, so the
 * predicate is derivable from the group localName — no hand-maintained map.
 */
function groupPredicate(group: string): string {
  return `has${group}`
}

/**
 * Resolve which SPARQL prefix should be used for a property.
 *
 * Strategy: Properties can exist in multiple domains (e.g., roadTypes in both hdmap and ositrace).
 * We use the target domain's prefix if the property exists there, otherwise find the correct
 * registry entry by matching the property's full IRI namespace against registered domains.
 *
 * Returns the SPARQL prefix alias (e.g., "hdmap", "openlabel_v2") that correctly
 * expands to the property's namespace. This may differ from the domain name used
 * in the vocabulary index (e.g., IRI-derived "openlabel" maps to prefix "openlabel_v2").
 */
function resolvePropertyPrefix(
  propName: string,
  targetDomain: string,
  vocabIndex: { properties: Map<string, CompilerProperty> },
  registry: Awaited<ReturnType<typeof buildDomainRegistry>>
): { prefix: string; foreignDomain: string | null } {
  const propInfo = vocabIndex.properties.get(propName)

  // If the property doesn't exist in vocabulary, use target domain
  if (!propInfo) {
    const d = registry.domains.get(targetDomain)
    return { prefix: d?.prefix ?? targetDomain, foreignDomain: null }
  }

  // If the property exists in the target domain, use its prefix
  if (propInfo.domains.has(targetDomain)) {
    const d = registry.domains.get(targetDomain)
    return { prefix: d?.prefix ?? targetDomain, foreignDomain: null }
  }

  // Property belongs to a foreign domain. Use its IRI to find the correct
  // registry entry (handles cases where IRI-derived name ≠ registry key,
  // e.g., "openlabel" from IRI vs "openlabel-v2" registry key).
  const firstDomain = propInfo.domains.values().next().value as string | undefined
  const propIri = firstDomain ? propInfo.iris.get(firstDomain) : undefined

  if (propIri) {
    // Extract namespace from property IRI (everything up to the local name)
    const lastSlash = propIri.lastIndexOf('/')
    const namespace = lastSlash >= 0 ? propIri.substring(0, lastSlash + 1) : propIri

    // Find registry entry with matching namespace
    for (const desc of registry.domains.values()) {
      if (desc.namespace === namespace) {
        return { prefix: desc.prefix, foreignDomain: desc.name }
      }
    }
  }

  // Fallback: try IRI-derived domain name against registry
  if (firstDomain) {
    const resolved = registry.domains.get(firstDomain) ?? registry.resolveByIriDomain(firstDomain)
    if (resolved) {
      return { prefix: resolved.prefix, foreignDomain: resolved.name }
    }
  }

  // Last resort: use the IRI-derived domain name directly
  return { prefix: firstDomain ?? targetDomain, foreignDomain: firstDomain ?? null }
}

// `isIri` is imported from `@ontology-search/sparql/escape` (see the
// `escapeSparqlLiteral` re-export above for rationale). The previous
// in-file prefix-only check (`^https?://|^urn:`) was both too narrow
// (it missed `did:web:` IRIs in the project's sample data) and too lax
// (it accepted any garbage after the scheme); the lifted version
// enforces the full SPARQL `IRIREF` body grammar.

/**
 * A slot value carries information iff it's a non-empty string or a
 * non-empty array. Used by the compiler to decide whether to emit the
 * graph pattern + filter for a given slot — empty values must produce
 * no triple at all, never a dangling pattern or `IN ()` clause.
 */
function isNonEmpty(value: string | string[] | undefined): value is string | string[] {
  if (value === undefined) return false
  if (typeof value === 'string') return value.length > 0
  return Array.isArray(value) && value.length > 0
}

/**
 * A property name is "known to the schema" if any of the graph-derived
 * indexes references it. The indexes are populated from disjoint SPARQL
 * patterns (sh:property paths, shape-group nesting, Range2D detection,
 * property-path BFS) so checking only one would under-recognise valid
 * properties.
 *
 * Used as the defense-in-depth filter in `partitionFiltersByDomain` —
 * unknown keys never reach SPARQL compilation.
 *
 * The `paths` index check catches deep-chain leaf properties (e.g.
 * ENVITED-X country / state / region / city, which live behind the
 * georeference chain and don't appear in `queryPropertyDomains` with a
 * domain-specific target class — they're owned by a sub-shape whose
 * `sh:targetClass` is `georeference:ProjectLocation`). Without this gate
 * deep-chain filters would be dropped by `partitionFiltersByDomain`
 * before reaching the compiler.
 */
function isKnownProperty(propName: string, vocabIndex: CompilerVocab): boolean {
  if (vocabIndex.properties.has(propName)) return true
  if (vocabIndex.range2DProperties.has(propName)) return true
  if (vocabIndex.shapeGroupPropertyNames.has(propName)) return true
  for (const key of vocabIndex.paths.keys()) {
    if (key.endsWith(`:${propName}`)) return true
  }
  return false
}

/**
 * Emit a FILTER clause for a location field that may be a single string or
 * an array. Generic — used for every georeference:* literal slot.
 *
 *  - **Array**: `FILTER(?v IN ("DE","FR","IT"))` — exact equality over a set,
 *    so a region expressed as a list of codes filters precisely.
 *  - **Single string**: `FILTER(CONTAINS(STR(?v), "FR"))` — textual matching
 *    over the string form of the RDF term, so the same filter works for both
 *    literal values and IRI-valued location resources.
 */
function addLocationFilter(filters: string[], varName: string, value: string | string[]): void {
  // W3C SPARQL 1.1 §17.4.2: LCASE() requires a string argument.
  // STR() converts IRIs and typed literals to their lexical string form,
  // making this safe for both IRI-valued and literal-valued properties.
  if (Array.isArray(value)) {
    if (value.length === 1) {
      const v = escapeSparqlLiteral(value[0]!.toLowerCase())
      filters.push(`FILTER(LCASE(STR(${varName})) = "${v}")`)
    } else {
      const lits = value.map((v) => `"${escapeSparqlLiteral(v.toLowerCase())}"`).join(', ')
      filters.push(`FILTER(LCASE(STR(${varName})) IN (${lits}))`)
    }
  } else {
    const v = escapeSparqlLiteral(value.toLowerCase())
    filters.push(`FILTER(CONTAINS(LCASE(STR(${varName})), "${v}"))`)
  }
}

/**
 * SPARQL property path that walks reflexive-transitively up SKOS and RDFS
 * hierarchies. Used to expand an IRI-valued filter to include all narrower
 * concepts / subclasses generically — the hierarchies must be declared in
 * the loaded graphs; this code does not name any specific concept scheme.
 *
 *   - `skos:broaderTransitive*` — covers SKOS concept narrower-than chains
 *   - `rdfs:subClassOf*`        — covers OWL/RDFS class subClassOf chains
 *
 * Both predicates are W3C-standard and reflexive in their `*` form, so the
 * expanded set always includes the filter value itself.
 *
 * @see https://www.w3.org/TR/skos-reference/#semantic-relations
 * @see https://www.w3.org/TR/rdf-schema/#ch_subclassof
 */
const HIERARCHY_EXPANSION_PATH = `(<${iri('skos', 'broaderTransitive')}>|<${iri('rdfs', 'subClassOf')}>)*`

/**
 * Add a FILTER (or graph pattern) for an enum value.
 *
 * - **Literal value(s)**: emits the existing `FILTER(?v = "lit")` form.
 * - **IRI value(s)**: emits a reflexive-transitive SPARQL property path,
 *   so the filter matches any concept narrower than the IRI in any
 *   `skos:broaderTransitive` or `rdfs:subClassOf` chain loaded into the
 *   store. This is the generic IRI-expansion gate: no specific hierarchy
 *   is hardcoded; the engine walks whatever is declared.
 *
 *   Example: with `<.../region/europe>` declared as the broader concept of
 *   {`<.../country/DE>`, `<.../country/FR>`, …}, a filter for `europe`
 *   expands to the full country set automatically.
 *
 *   When no hierarchy edges are present in the data, the path matches only
 *   the IRI itself (reflexive case) — same semantics as plain equality.
 */
function addEnumFilter(
  patterns: string[],
  filters: string[],
  varName: string,
  value: string | string[]
): void {
  const arr = Array.isArray(value) ? value : [value]
  const iriValues = arr.filter(isIri)
  const literalValues = arr.filter((v) => !isIri(v))

  if (literalValues.length === 1) {
    filters.push(`FILTER(${varName} = "${escapeSparqlLiteral(literalValues[0]!)}")`)
  } else if (literalValues.length > 1) {
    const values = literalValues.map((v) => `"${escapeSparqlLiteral(v)}"`).join(', ')
    filters.push(`FILTER(${varName} IN (${values}))`)
  }

  for (const iri of iriValues) {
    // The hierarchy walk is emitted as an additional graph pattern, not a
    // FILTER, so the property path is evaluated by the SPARQL engine against
    // every loaded named graph (schema, codelists, instances, …) generically.
    patterns.push(`${varName} ${HIERARCHY_EXPANSION_PATH} <${iri}> .`)
  }
}

/**
 * Generate a count query for all assets in a specific domain.
 */
export async function compileCountQuery(domainName: string): Promise<string> {
  const registry = await buildDomainRegistry()
  const domain = registry.domains.get(domainName)

  if (!domain) {
    throw new CompileError(`Unknown domain: ${domainName}`)
  }

  const prefixes = registry.prefixesFor(domainName)
  return `${prefixes}
SELECT (COUNT(DISTINCT ?asset) AS ?count) WHERE {
  ?asset a ${domain.targetClass} .
}`
}

/**
 * Generate count queries for all known domains.
 */
export async function compileAllCountQueries(): Promise<{ domain: string; query: string }[]> {
  const registry = await buildDomainRegistry()
  const assetDomains = await getAssetDomains()
  const queries: { domain: string; query: string }[] = []

  for (const domainName of registry.domainNames) {
    if (!assetDomains.has(domainName)) continue
    const domain = registry.domains.get(domainName)!
    const prefixes = registry.prefixesFor(domainName)
    queries.push({
      domain: domainName,
      query: `${prefixes}\nSELECT (COUNT(DISTINCT ?asset) AS ?count) WHERE {\n  ?asset a ${domain.targetClass} .\n}`,
    })
  }

  return queries
}
