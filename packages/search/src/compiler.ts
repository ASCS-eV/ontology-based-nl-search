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
import { createComponentLogger } from '@ontology-search/core/logging'
import { sparqlPrefix } from '@ontology-search/core/rdf/prefixes'
import {
  buildDomainRegistry,
  type DomainDescriptor,
  type DomainRegistry,
} from '@ontology-search/ontology/domain-registry'
import { escapeSparqlLiteral } from '@ontology-search/sparql/escape'

// `getAssetDomains` lives in `./asset-domains.js` (broke a compiler ↔
// reference-index cycle); the vocab/cache + warmup half of the compiler lives in
// `./compiler-vocab.js` (ADR 0003 step 1).
import { getAssetDomains } from './asset-domains.js'
// SPARQL-emit + classification leaf helpers (the downward-closed cluster the
// compile core depends on) live in `./compiler-helpers.js` (ADR 0003 step 1b).
import {
  addEnumFilter,
  addLocationFilter,
  assembleQuery,
  buildPrefixes,
  classifyProperty,
  detectHierarchy,
  emitDataReferencePath,
  emitDeepFilters,
  emitDirectPathFilters,
  emitReferenceChainTriples,
  findDomainForIri,
  groupPredicate,
  groupVariableName,
  isNonEmpty,
  lookupDomainSpecPredicate,
  lookupStepPredicate,
  partitionFiltersByDomain,
  partitionRangesByDomain,
  pickDataReferenceEdge,
  pickReferenceChain,
  pickSiblingDataEdge,
  prefixedPredicate,
  resolvePrimaryDomain,
  resolvePropertyPrefix,
  SHALLOW_PATH_MAX_STEPS,
} from './compiler-helpers.js'
import { type CompilerVocab, getCompilerVocab, getDomainReferences } from './compiler-vocab.js'
import { type PropertyPath } from './property-paths.js'
import { getReferenceIndex } from './reference-index.js'
import type {
  CompileResult,
  ReferenceFilter,
  SearchSlots,
  TraceabilityPlan,
  TraceabilityStep,
} from './slots.js'
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

const log = createComponentLogger('compiler')

/**
 * Compile a UNION query for peer domains — independent asset types that
 * share similar properties (the same property local name in more than one
 * domain).
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

  // License is handled as a normal `filters` entry keyed by the SHACL leaf
  // local name. License chains are emitted by the generic deep-filter
  // machinery inside `buildDomainPatterns` (one chain per UNION arm). No
  // outer license OPTIONAL block needed.

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
  // JOINs that would eliminate results. (Location and other geographic
  // fields flow through `slots.filters` and partition naturally to
  // whichever domain owns the matching property path — there is no
  // special-case delegation to a referenced domain.)
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

    // Join via the discovered cross-reference chain. No meta-model
    // predicates are baked in here — the chain
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

    // Reference-scoped constraints: `filters`/`ranges` that describe the
    // REFERENCED asset (e.g. "maps in Germany with >= 1 intersection") are
    // applied to THIS reference's variable, so they constrain the referenced
    // asset — not the primary one. Without this, such constraints partition to
    // the top level and bind to the wrong domain (the cross-domain anchoring
    // bug). Reuses the same SHACL-path machinery as the primary domain; the
    // chain emission above already bound `${refVar} a <targetClass>`.
    const refOwnFilters = ref.filters ?? {}
    const refOwnRanges = ref.ranges ?? {}
    if (Object.keys(refOwnFilters).length > 0 || Object.keys(refOwnRanges).length > 0) {
      const refForeign = buildDomainPatterns(
        ref.domain,
        refDomain,
        refOwnFilters,
        refOwnRanges,
        patterns,
        filters,
        optionals,
        selectVars,
        vocabIndex,
        registry,
        refVar,
        `${refVar}_spec`
      )
      for (const fd of refForeign) prefixDomains.add(fd)
    }

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

  // Generic filter emission — location and license are ordinary
  // `slots.filters` entries keyed by their SHACL leaf local names. For
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
 *     intermediate (e.g. two leaves under the same intermediate node)
 *     reuse the same chain emission.
 *
 * No ontology-specific field names are referenced. The compiler reads
 * which filters are "deep" purely from the SHACL graph at runtime.
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
  //     (the `asset → specification → group → leaf` meta-model). Emitted
  //     by the shape-group machinery below.
  //   - DEEP: a path longer than the shape-group standard — walked from the
  //     spec variable via emitDeepFilters.
  //   - DIRECT: a property with NO shape group anywhere (a flat ontology's
  //     `asset → leaf`, or any non-meta-model schema). Walked straight from
  //     the asset variable — no fabricated specification/group hops. This is
  //     what makes the compiler work on a schema that is not shaped like the
  //     specification meta-model.
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
  // the SHACL graph actually puts it in.
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
    // First hop: asset → specification node. The predicate is discovered from
    // any shape-group/deep property's path (every such property in this domain
    // shares the first step). When the specific properties in this query have
    // no path of their own, fall back to any shape-group property in the same
    // domain — never to a hard-coded predicate name.
    const candidatePropertyNames = [
      ...shapeGroupFilterEntries.map(([n]) => n),
      ...deepFilterEntries.map(([n]) => n),
      ...shapeGroupRangeEntries.map(([n]) => n),
    ]
    const assetToSpecPredicate =
      lookupStepPredicate(vocabIndex, domain, candidatePropertyNames, 0) ??
      lookupDomainSpecPredicate(vocabIndex, domain)
    if (!assetToSpecPredicate) {
      throw new CompileError(
        `Cannot determine the asset→specification predicate for domain "${domainName}": ` +
          `no shape-group property has a discovered SHACL path. The schema declares shape ` +
          `groups whose property paths could not be resolved.`
      )
    }
    patterns.push(`${assetVar} ${assetToSpecPredicate} ${specVar} .`)
  }

  const groupsToEmit = new Set<string>([...filterPropsByGroup.keys(), ...rangePropsByGroup.keys()])

  for (const group of [...groupsToEmit].sort()) {
    // Pre-resolve all property prefixes and sub-group by prefix.
    // Properties from different ontology domains may live on separate RDF
    // nodes even when they share the same shape group (two domains' group
    // nodes reachable via the same group predicate). Binding them
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
  // prefix (e.g. two location leaves under the same intermediate node)
  // reuse the same intermediate
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
