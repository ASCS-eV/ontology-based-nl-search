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
 * Cross-domain support: When filters span multiple ontology domains, the
 * compiler identifies the primary domain (the one that references others
 * through the discovered reference-predicate chain) and builds a join.
 *
 * Meta-model: many ontologies group an asset's leaf properties under
 * intermediate shape nodes (asset → specification → group → leaf). The
 * compiler discovers this structure from the SHACL graph at runtime rather
 * than assuming any fixed predicate names, so it also works on flat ontologies
 * that attach leaves directly to the asset.
 *
 * STANDARDS — the emitted query string conforms to:
 *   [SPARQL11] SPARQL 1.1 Query Language — docs/specs/references/sparql11-query.md
 *              https://www.w3.org/TR/sparql11-query/
 * Reference-scoped filters/ranges (see `emitReferenceNode`) bind to the
 * referenced asset's variable, so a constraint on a referenced asset compiles
 * to a basic graph pattern rooted at that asset — [SPARQL11] §5 (BGP).
 */
import { getConfig } from '@ontology-search/core/config'
import { CompileError } from '@ontology-search/core/errors'
import { buildDomainRegistry, type DomainRegistry } from '@ontology-search/ontology/domain-registry'

// `getAssetDomains` lives in `./asset-domains.js` (broke a compiler ↔
// reference-index cycle); the vocab/cache + warmup half of the compiler lives in
// `./compiler-vocab.js` (ADR 0003 step 1).
import { getAssetDomains } from './asset-domains.js'
import { compileCrossDomainQuery, compilePeerDomainUnion } from './compiler-cross-domain.js'
import { buildDomainPatterns } from './compiler-domain-patterns.js'
// SPARQL-emit leaf helpers live in `./compiler-helpers.js` (ADR 0003 step 1b);
// the per-domain pattern builder, the multi-domain query forms, and the
// reference-JOIN emitters were further split out (step 22c) so this core stays
// under the file-size budget.
import {
  assembleQuery,
  buildPrefixes,
  detectHierarchy,
  partitionFiltersByDomain,
  partitionRangesByDomain,
  resolvePrimaryDomain,
} from './compiler-helpers.js'
import {
  emitReferencedDomainJoins,
  emitReferenceNode,
  type ReferenceEmitContext,
} from './compiler-reference-emit.js'
import { type CompilerVocab, getCompilerVocab, getDomainReferences } from './compiler-vocab.js'
import type { CompileResult, SearchSlots, TraceabilityPlan } from './slots.js'
import { normalizeReferences } from './slots.js'

// `escapeSparqlLiteral` + `isIri` are sourced from
// `@ontology-search/sparql/escape` (re-exported here so the existing
// `@ontology-search/search` public surface — used by the api app — keeps
// shipping `escapeSparqlLiteral`).
export { escapeSparqlLiteral } from '@ontology-search/sparql/escape'

// Re-export the extracted compiler submodules (ADR 0003, step 1) so the existing
// `@ontology-search/search` public surface and intra-package importers keep
// resolving these from `./compiler.js` unchanged.
export { buildCompilerVocabFrom, getCompilerVocab, warmupCompiler } from './compiler-vocab.js'
export { compileAllCountQueries, compileCountQuery } from './count-query.js'

/**
 * Compile structured search slots into a valid SPARQL SELECT query.
 * Resolves the target domain(s) from the registry and builds
 * appropriate graph patterns.
 *
 * When multiple peer domains are selected (no parent-child reference),
 * generates a UNION query searching all domains independently.
 *
 * When filters span domains with a referencing hierarchy (one asset
 * domain referencing another), identifies the primary (composite)
 * domain and generates a join through the discovered reference chain.
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
 * to drive the compiler against an arbitrary schema (the seam the
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
  // domains get a JOIN through the discovered reference chain.
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
  // discovered during pattern generation, e.g., a foreign domain's properties
  // used inside another domain's query).
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

  // Shared mutable compile state for the reference emitters. Built once and
  // threaded through both the implicit cross-domain joins and the explicit
  // `slots.references` emission so they accumulate into the same query state;
  // `hasReferenceJoin` is read back below to decide the distinct-asset LIMIT wrap.
  const refCtx: ReferenceEmitContext = {
    registry,
    vocabIndex,
    patterns,
    filters,
    optionals,
    selectVars,
    prefixDomains,
    traces,
    droppedReferences,
    hasReferenceJoin: false,
  }

  // Implicit cross-domain JOINs: referenced (non-primary) domains that carry
  // their own filters/ranges.
  emitReferencedDomainJoins(detectedDomains, primaryDomain, filtersByDomain, rangesByDomain, refCtx)

  // License is handled as a regular `slots.filters` entry keyed by the
  // SHACL leaf local name. The chain is emitted by the generic deep-filter
  // machinery in buildDomainPatterns, so no license-specific OPTIONAL block
  // is needed here.

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
  // child), so a nested reference becomes parent → child → grandchild rather
  // than two flat siblings (parent → child AND parent → grandchild). Every
  // node is projected and each with
  // a resolved chain contributes its own breadcrumb plan. The distinct-asset
  // wrap (assembleQuery) keeps the LIMIT counting primary assets despite the
  // (now deeper) reference fan-out. See `emitReferenceNode`.
  const referenceSlots = normalizeReferences(slots.references)
  for (let i = 0; i < referenceSlots.length; i++) {
    await emitReferenceNode(
      referenceSlots[i]!,
      '?asset',
      primaryDomain,
      i === 0 ? 'refAsset' : `refAsset${i}`,
      refCtx
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
      refCtx.hasReferenceJoin ? '?asset' : undefined
    ),
    trace: traces.length > 0 ? traces : undefined,
    droppedReferences: droppedReferences.length > 0 ? droppedReferences : undefined,
  }
}
