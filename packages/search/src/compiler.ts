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
import { iri, sparqlPrefix } from '@ontology-search/core/rdf/prefixes'
import {
  buildDomainRegistry,
  type DomainDescriptor,
  type DomainRegistry,
} from '@ontology-search/ontology/domain-registry'
import { escapeSparqlLiteral, isIri } from '@ontology-search/sparql/escape'

import { getInitializedStore } from './init.js'
import { buildPropertyPaths, type PropertyPath } from './property-paths.js'
import {
  queryAssetDomains,
  queryDomainReferences,
  queryPropertyDomains,
  queryPropertyShapeGroups,
  queryRange2DProperties,
} from './schema-queries.js'
import type { SearchSlots } from './slots.js'
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
  /** Properties that use Range2D structure (min/max sub-properties) */
  range2DProperties: Set<string>
  /**
   * Discovered property paths keyed by `${domain}:${propertyLocalName}`.
   * Each path lists the predicate hops from an asset class to the leaf
   * value — the compiler reads predicates from these instead of
   * hard-coding `hasDomainSpecification` and `has${Group}` literals.
   *
   * Sourced from `buildPropertyPaths` (task 21a) so the ENVITED-X
   * meta-model is no longer a compile-time assumption.
   */
  paths: Map<string, PropertyPath>
}

// `escapeSparqlLiteral` + `isIri` are sourced from
// `@ontology-search/sparql/escape` (re-exported here so the existing
// `@ontology-search/search` public surface — used by the api app — keeps
// shipping `escapeSparqlLiteral`).
export { escapeSparqlLiteral } from '@ontology-search/sparql/escape'

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
  limit: number = getConfig().SPARQL_DEFAULT_LIMIT
): string {
  const vars = selectVars instanceof Set ? [...selectVars] : selectVars
  const selectClause = `SELECT ${vars.join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')

  const query = `${prefixes}\n${selectClause} WHERE {\n  ${whereBody}\n}\nLIMIT ${limit}`

  // Post-assembly validation: catch syntax errors and W3C compliance issues
  const validation = validateSparql(query)
  if (!validation.valid) {
    console.error('[compiler] Generated SPARQL has errors:', validation.errors)
  }
  if (validation.warnings.length > 0) {
    console.warn('[compiler] SPARQL warnings:', validation.warnings)
  }

  return query
}

/** Cached compiler vocabulary (ontology doesn't change at runtime) */
let cachedCompilerVocab: CompilerVocab | null = null

/** Build the compiler vocabulary from the ontology schema graph using SPARQL queries */
async function getCompilerVocab(): Promise<CompilerVocab> {
  if (cachedCompilerVocab) return cachedCompilerVocab

  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()
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
  const shapeGroups = new Map<string, string>()
  for (const { localName, domain, shapeGroup } of shapeGroupInfos) {
    shapeGroups.set(`${localName}:${domain}`, shapeGroup)
  }

  // Build Range2D property set
  const range2DProperties = new Set<string>()
  for (const { localName } of range2DInfos) {
    range2DProperties.add(localName)
  }

  // Index property paths by (domain, propertyLocalName) for O(1) lookup
  // when emitting triples. A property may legitimately appear in multiple
  // asset domains (e.g., roadTypes in both hdmap and ositrace); each
  // domain gets its own path.
  const paths = new Map<string, PropertyPath>()
  for (const path of propertyPaths) {
    paths.set(`${path.domain}:${path.propertyName}`, path)
  }

  cachedCompilerVocab = { properties, shapeGroups, range2DProperties, paths }
  return cachedCompilerVocab
}

/** Cached asset domains (queried from ontology graph at startup) */
let cachedAssetDomains: Set<string> | null = null

/** Get all asset domains from the ontology graph */
export async function getAssetDomains(): Promise<Set<string>> {
  if (cachedAssetDomains) return cachedAssetDomains

  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()
  const domainInfos = await queryAssetDomains(store, registry)
  cachedAssetDomains = new Set(domainInfos.map((d) => d.domainName))

  if (cachedAssetDomains.size === 0) {
    console.warn('[compiler] No asset domains found via rdfs:subClassOf — check ontology loading')
  }

  return cachedAssetDomains
}

/** Cached domain references (queried from ontology graph at startup) */
let cachedDomainReferences: Map<string, Set<string>> | null = null

/** Get domain reference relationships from the ontology graph */
async function getDomainReferences(): Promise<Map<string, Set<string>>> {
  if (cachedDomainReferences) return cachedDomainReferences

  const store = await getInitializedStore()
  const registry = await buildDomainRegistry()

  // Get asset domain infos to filter references to known asset classes
  const assetDomainInfos = await queryAssetDomains(store, registry)
  const knownAssetClasses = new Set(assetDomainInfos.map((d) => d.assetClass))

  const refs = await queryDomainReferences(store, registry, knownAssetClasses)
  cachedDomainReferences = new Map()

  for (const { parentDomain, childDomain } of refs) {
    const existing = cachedDomainReferences.get(parentDomain)
    if (existing) {
      existing.add(childDomain)
    } else {
      cachedDomainReferences.set(parentDomain, new Set([childDomain]))
    }
  }

  return cachedDomainReferences
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

  for (const domainName of domains) {
    const domain = registry.domains.get(domainName)
    if (!domain) continue

    prefixDomains.add(domainName)

    const armPatterns: string[] = []
    const armFilters: string[] = []
    const armOptionals: string[] = []
    const armSelectVars = new Set<string>()

    // Base pattern — asset type + label
    armPatterns.push(`?asset a ${domain.targetClass} ;`)
    armPatterns.push('  rdfs:label ?name .')

    // Build domain-specific patterns
    const domainFilters = filtersByDomain[domainName] || {}
    const domainRanges = rangesByDomain[domainName] || {}
    const foreignDomains = buildDomainPatterns(
      domainName,
      domain,
      domainFilters,
      domainRanges,
      slots.location,
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

  // License (shared across all domains, placed outside UNION)
  if (slots.license) {
    const firstDomain = registry.domains.get(domains[0]!)
    if (firstDomain) {
      outerFilters.push(`OPTIONAL {
    ?asset ${firstDomain.prefix}:hasResourceDescription ?resDesc .
    ?resDesc gx:license ?license .
  }`)
      outerFilters.push(`FILTER(?license = "${escapeSparqlLiteral(slots.license)}")`)
      selectVars.add('?license')
      prefixDomains.add(domains[0]!)
    }
  }

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
export async function compileSlots(slots: SearchSlots): Promise<string> {
  const registry = await buildDomainRegistry()
  const vocabIndex = await getCompilerVocab()

  // When no domain is specified, use cross-domain search
  if (slots.domains.length === 0) {
    const assetDomains = await getAssetDomains()
    return compileCrossDomainQuery(slots, registry, assetDomains, vocabIndex)
  }

  const detectedDomains = slots.domains

  // Partition filters by domain
  const filtersByDomain = partitionFiltersByDomain(slots.filters, detectedDomains, vocabIndex)

  // Partition ranges by domain
  const rangesByDomain = partitionRangesByDomain(slots.ranges, detectedDomains, vocabIndex)

  // Determine whether the domains are peers (no parent-child relationship)
  // or have a referencing hierarchy. Peer domains get a UNION query; parent-child
  // domains get a JOIN via manifest:hasReferencedArtifacts.
  const domainRefs = await getDomainReferences()
  const hasHierarchy = detectedDomains.length > 1 && detectHierarchy(detectedDomains, domainRefs)

  if (!hasHierarchy && detectedDomains.length > 1) {
    // Peer domains: generate UNION query that searches all domains independently
    return compilePeerDomainUnion(
      slots,
      detectedDomains,
      filtersByDomain,
      rangesByDomain,
      registry,
      vocabIndex
    )
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
    slots.location,
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

  // Build cross-domain joins for referenced domains.
  // Only include domains that have actual filters, ranges, or will receive
  // a delegated location filter. Domains selected by the LLM but without
  // any constraint are skipped to avoid over-constraining the query with
  // mandatory JOINs that eliminate results.
  const allReferencedDomains = new Set([
    ...Object.keys(filtersByDomain).filter((d) => d !== primaryDomain),
    ...Object.keys(rangesByDomain).filter((d) => d !== primaryDomain),
    ...detectedDomains.filter((d) => d !== primaryDomain),
  ])

  // Determine whether the primary domain can handle location filters.
  // If not, delegate location to the first referenced domain that has
  // location properties — avoids silently dropping the filter entirely.
  const hasLocationSlots =
    !!slots.location &&
    (isNonEmpty(slots.location.country) ||
      isNonEmpty(slots.location.state) ||
      isNonEmpty(slots.location.region) ||
      isNonEmpty(slots.location.city))
  const primaryHasLocation = hasLocationSlots && vocabIndex.paths.has(`${primaryDomain}:country`)
  let _locationDelegated = primaryHasLocation

  // Pre-scan: determine which referenced domain will receive delegated location
  let locationDelegateDomain: string | undefined
  if (hasLocationSlots && !primaryHasLocation) {
    for (const refDomainName of allReferencedDomains) {
      if (vocabIndex.paths.has(`${refDomainName}:country`)) {
        locationDelegateDomain = refDomainName
        break
      }
    }
  }

  for (const refDomainName of allReferencedDomains) {
    const refDomain = registry.domains.get(refDomainName)
    if (!refDomain) continue

    const refFilters = filtersByDomain[refDomainName] || {}
    const refRanges = rangesByDomain[refDomainName] || {}
    const willReceiveLocation = refDomainName === locationDelegateDomain

    // Skip referenced domains that have no filters, ranges, or delegated
    // location — they add only constraints (mandatory JOINs) without value.
    const hasRefConstraints =
      Object.keys(refFilters).length > 0 || Object.keys(refRanges).length > 0 || willReceiveLocation
    if (!hasRefConstraints) continue

    // Join via manifest → hasReferencedArtifacts
    const refVar = `?ref_${refDomainName.replace(/-/g, '_')}`
    const refSpecVar = `?refSpec_${refDomainName.replace(/-/g, '_')}`

    patterns.push(`?asset ${domain.prefix}:hasManifest ?manifest .`)
    patterns.push(`?manifest manifest:hasReferencedArtifacts ${refVar} .`)
    patterns.push(`${refVar} a ${refDomain.targetClass} .`)

    // Location delegation: if the primary domain has no location properties,
    // pass the location filter to exactly ONE referenced domain that does.
    let refLocation: SearchSlots['location'] | undefined
    if (willReceiveLocation) {
      refLocation = slots.location
      _locationDelegated = true
    }

    const refForeign = buildDomainPatterns(
      refDomainName,
      refDomain,
      refFilters,
      refRanges,
      refLocation,
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
  }

  // License (via resource description — shared across all domains)
  if (slots.license) {
    optionals.push(`OPTIONAL {
    ?asset ${domain.prefix}:hasResourceDescription ?resDesc .
    ?resDesc gx:license ?license .
  }`)
    filters.push(`FILTER(?license = "${escapeSparqlLiteral(slots.license)}")`)
    selectVars.add('?license')
  }

  // Cross-reference join: find assets that reference another domain
  if (slots.references) {
    const refDomain = registry.domains.get(slots.references.domain)
    if (refDomain) {
      prefixDomains.add('manifest')
      prefixDomains.add(slots.references.domain)
      // Each domain defines its own hasManifest (subProperty of the base hasManifest)
      patterns.push(`?asset ${domain.prefix}:hasManifest ?_refManifest .`)
      patterns.push(`?_refManifest manifest:hasReferencedArtifacts ?_refLink .`)
      patterns.push(`?_refLink manifest:iri ?refAsset .`)
      patterns.push(`?refAsset a ${refDomain.targetClass} .`)
      patterns.push(`?refAsset rdfs:label ?refName .`)
      selectVars.add('?refAsset')
      selectVars.add('?refName')

      if (slots.references.label) {
        filters.push(
          `FILTER(CONTAINS(LCASE(?refName), "${escapeSparqlLiteral(slots.references.label.toLowerCase())}"))`
        )
      }
    }
  }

  // Generate prefixes AFTER all pattern generation so all domains are included
  const prefixes = buildPrefixes(registry, [...prefixDomains])

  // Build the query
  return assembleQuery(prefixes, selectVars, patterns, optionals, filters)
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

  // Apply location filters using discovered property paths.
  // For cross-domain queries, we build SPARQL property path alternatives
  // from all domains that have location properties.
  const hasLocationFilter =
    !!slots.location &&
    (isNonEmpty(slots.location.country) ||
      isNonEmpty(slots.location.state) ||
      isNonEmpty(slots.location.region) ||
      isNonEmpty(slots.location.city))

  if (hasLocationFilter) {
    // Find any domain that has a 'country' property path — use it to
    // discover the predicate chain for location queries.
    let locationPath: PropertyPath | undefined
    for (const [key, path] of vocabIndex.paths) {
      if (key.endsWith(':country') && path.steps.length >= 4) {
        locationPath = path
        break
      }
    }

    if (locationPath) {
      // Build the location block using full IRIs (ontology-agnostic)
      const step0 = locationPath.steps[0] // asset → domSpec
      const step1 = locationPath.steps[1] // domSpec → georef
      const step2 = locationPath.steps[2] // georef → location

      // Add prefixes for the domains involved
      const ensurePrefix = (predicateIri: string) => {
        const desc = findDomainForIri(predicateIri, registry)
        if (desc && !usedPrefixes.has(desc.name)) {
          usedPrefixes.add(desc.name)
          prefixLines.push(`PREFIX ${desc.prefix}: <${desc.namespace}>`)
        }
        return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
      }

      if (step0 && step1 && step2) {
        const pred0 = ensurePrefix(step0.predicate)
        const pred1 = ensurePrefix(step1.predicate)
        const pred2 = ensurePrefix(step2.predicate)

        optionals.push(`OPTIONAL {
    ?asset ${pred0} ?domSpec .
    ?domSpec ${pred1} ?georef .
    ?georef ${pred2} ?loc .`)

        const locationFields = [
          { field: 'country', value: slots.location!.country },
          { field: 'city', value: slots.location!.city },
          { field: 'state', value: slots.location!.state },
          { field: 'region', value: slots.location!.region },
        ]

        for (const { field, value } of locationFields) {
          if (!isNonEmpty(value)) continue
          // Find the leaf predicate for this field
          const fieldPath = vocabIndex.paths.get(`${locationPath.domain}:${field}`)
          if (!fieldPath) continue
          const leafStep = fieldPath.steps[fieldPath.steps.length - 1]
          if (!leafStep) continue
          const leafPred = ensurePrefix(leafStep.predicate)
          optionals.push(`    ?loc ${leafPred} ?${field} .`)
          addLocationFilter(filters, `?${field}`, value)
          selectVars.push(`?${field}`)
        }

        optionals.push(`  }`)
      }
    }
  }

  // License filter — discover the predicate chain from property paths
  if (slots.license) {
    // Find the 'license' property path from any domain
    let licensePath: PropertyPath | undefined
    for (const [key, path] of vocabIndex.paths) {
      if (key.endsWith(':license')) {
        licensePath = path
        break
      }
    }

    if (licensePath && licensePath.steps.length >= 2) {
      const ensurePrefix = (predicateIri: string) => {
        const desc = findDomainForIri(predicateIri, registry)
        if (desc && !usedPrefixes.has(desc.name)) {
          usedPrefixes.add(desc.name)
          prefixLines.push(`PREFIX ${desc.prefix}: <${desc.namespace}>`)
        }
        return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
      }

      // Build the chain: asset → resDesc → license
      const resDescPred = ensurePrefix(licensePath.steps[0]!.predicate)
      const licensePred = ensurePrefix(licensePath.steps[licensePath.steps.length - 1]!.predicate)
      optionals.push(`OPTIONAL {
    ?asset ${resDescPred} ?resDesc .
    ?resDesc ${licensePred} ?license .
  }`)
    } else {
      // Fallback: use full IRI if no path found
      optionals.push(`OPTIONAL {
    ?asset <urn:unknown:hasResourceDescription> ?resDesc .
    ?resDesc <${iri('gx', 'license')}> ?license .
  }`)
    }
    filters.push(`FILTER(?license = "${escapeSparqlLiteral(slots.license)}")`)
    selectVars.push('?license')
  }

  // Build the query
  const prefixes = prefixLines.join('\n')
  return assembleQuery(prefixes, selectVars, patterns, optionals, filters)
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
 * Build patterns for a single domain's filters within the DomainSpecification structure.
 * Returns the set of foreign domain names whose prefixes were used in patterns
 * (i.e., properties that belong to a different domain than domainName).
 */
function buildDomainPatterns(
  domainName: string,
  domain: DomainDescriptor,
  domainFilters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  location: SearchSlots['location'] | undefined,
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
  const filterEntries = Object.entries(domainFilters)
  const rangeEntries = Object.entries(ranges)
  const hasLocationFilters =
    isNonEmpty(location?.country) ||
    isNonEmpty(location?.state) ||
    isNonEmpty(location?.region) ||
    isNonEmpty(location?.city)
  const needsDomSpec = filterEntries.length > 0 || rangeEntries.length > 0 || hasLocationFilters

  if (!needsDomSpec) return foreignDomains

  // First hop: asset → DomainSpecification. The predicate is discovered
  // from any property's path (they all share step 0), falling back to
  // the conventional `${prefix}:hasDomainSpecification` only when no
  // path was found — keeps the location-only branch (no filter/range
  // properties to consult) working until task 21d rewires location too.
  const candidatePropertyNames = [...filterEntries.map(([n]) => n), ...rangeEntries.map(([n]) => n)]
  const assetToSpecPredicate =
    lookupStepPredicate(vocabIndex, domain, candidatePropertyNames, 0) ??
    `${domain.prefix}:hasDomainSpecification`
  patterns.push(`${assetVar} ${assetToSpecPredicate} ${specVar} .`)

  // Group both filter entries AND range entries by their classified shape
  // group, discovered from the SHACL graph at runtime (see
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

  for (const [propName, value] of filterEntries) {
    const shape = classifyProperty(propName, domainName, vocabIndex)
    let bucket = filterPropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      filterPropsByGroup.set(shape, bucket)
    }
    bucket.push([propName, value])
  }

  for (const [propName, range] of rangeEntries) {
    const shape = classifyProperty(propName, domainName, vocabIndex)
    let bucket = rangePropsByGroup.get(shape)
    if (!bucket) {
      bucket = []
      rangePropsByGroup.set(shape, bucket)
    }
    bucket.push([propName, range])
  }

  const suffix = assetVar === '?asset' ? '' : `_${domainName.replace(/-/g, '_')}`

  // Emit every shape group that has at least one filter or range. Sort for
  // deterministic SPARQL output — the compiler-determinism snapshot suite
  // relies on this ordering.
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
        if (vocabIndex.range2DProperties.has(propName)) {
          const rangeNode = `?${propName}Range${suffix}`
          patterns.push(`${groupVar} ${propPrefix}:${propName} ${rangeNode} .`)
          if (range.min !== undefined) {
            const maxVar = `?${propName}Max${suffix}`
            patterns.push(`${rangeNode} ${propPrefix}:max ${maxVar} .`)
            filters.push(`FILTER(xsd:float(${maxVar}) >= ${range.min})`)
            selectVars.add(maxVar)
          }
          if (range.max !== undefined) {
            const minVar = `?${propName}Min${suffix}`
            patterns.push(`${rangeNode} ${propPrefix}:min ${minVar} .`)
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

  // Georeference location filters — discovered from property paths.
  // Don't check domain.hasGeoreference (hardcoded, ontology-specific).
  // Instead, check if this domain actually has location properties.
  if (hasLocationFilters) {
    const locationFields = ['country', 'state', 'region', 'city'] as const
    const locationValues = {
      country: location?.country,
      state: location?.state,
      region: location?.region,
      city: location?.city,
    }

    // Use the first available location property's path to discover the
    // predicate chain from DomainSpecification → georeference → location
    let geoPath: PropertyPath | undefined
    for (const field of locationFields) {
      const path = vocabIndex.paths.get(`${domainName}:${field}`)
      if (path && path.steps.length >= 3) {
        geoPath = path
        break
      }
    }

    if (geoPath) {
      // The path steps look like:
      //   [0] asset → DomainSpecification (already emitted above as assetToSpecPredicate)
      //   [1] DomainSpecification → Georeference sub-shape
      //   [2] Georeference → ProjectLocation
      //   [3] ProjectLocation → leaf (country/city/etc.)
      // We need steps [1] and [2] for the intermediate nodes.
      const geoStep = geoPath.steps[1]
      const locStep = geoPath.steps[2]
      if (geoStep && locStep) {
        const georefVar = `?georef${suffix}`
        const locVar = `?loc${suffix}`
        patterns.push(`${specVar} ${prefixedPredicate(geoStep.predicate, domain)} ${georefVar} .`)

        // The location predicate may be in a different domain (e.g., georeference:).
        // Use full IRI if it's not in this domain's namespace.
        const geoRefDomain = findDomainForIri(locStep.predicate, registry)
        const locPredicate = geoRefDomain
          ? prefixedPredicate(locStep.predicate, geoRefDomain)
          : `<${locStep.predicate}>`
        if (geoRefDomain && geoRefDomain.name !== domainName) {
          foreignDomains.add(geoRefDomain.name)
        }
        patterns.push(`${georefVar} ${locPredicate} ${locVar} .`)

        for (const field of locationFields) {
          if (!isNonEmpty(locationValues[field])) continue
          const fieldPath = vocabIndex.paths.get(`${domainName}:${field}`)
          if (!fieldPath) continue
          const leafStep = fieldPath.steps[fieldPath.steps.length - 1]
          if (!leafStep) continue
          const leafDomain = findDomainForIri(leafStep.predicate, registry)
          const leafPredicate = leafDomain
            ? prefixedPredicate(leafStep.predicate, leafDomain)
            : `<${leafStep.predicate}>`
          if (leafDomain && leafDomain.name !== domainName) {
            foreignDomains.add(leafDomain.name)
          }
          const v = `?${field}${suffix}`
          patterns.push(`${locVar} ${leafPredicate} ${v} .`)
          addLocationFilter(filters, v, locationValues[field])
          selectVars.add(v)
        }
      }
    }
  }

  return foreignDomains
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

  // Multi-domain: use ontology to find which detected domain owns each property.
  // A property may exist in MULTIPLE domains (e.g., roadTypes in both hdmap
  // and ositrace). Assign it to ALL matching domains so UNION queries work.
  for (const [propName, value] of Object.entries(known)) {
    const propInfo = vocabIndex.properties.get(propName)
    if (!propInfo) continue

    // Find ALL detected domains that define this property
    const matchingDomains = detectedDomains.filter((d) => propInfo.domains.has(d))

    for (const matchingDomain of matchingDomains) {
      if (!result[matchingDomain]) result[matchingDomain] = {}
      result[matchingDomain]![propName] = value
    }
    // If property not in any detected domain, skip it (validator will handle)
  }

  return result
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

  // Multi-domain: use ontology to find which detected domain owns each property.
  // A property may exist in MULTIPLE domains — assign to ALL matching domains.
  for (const [propName, range] of Object.entries(known)) {
    const propInfo = vocabIndex.properties.get(propName)

    if (!propInfo) {
      // Unknown property — skip (will be caught by validator)
      continue
    }

    // Find ALL detected domains that define this property
    const matchingDomains = detectedDomains.filter((d) => propInfo.domains.has(d))

    for (const matchingDomain of matchingDomains) {
      if (!result[matchingDomain]) result[matchingDomain] = {}
      result[matchingDomain]![propName] = range
    }
    // If property not in any detected domain, skip it (validator will handle)
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

  // W3C standard prefixes (stable, specification-defined)
  prefixSet.add(sparqlPrefix('rdfs'))
  prefixSet.add(sparqlPrefix('xsd'))
  prefixSet.add(sparqlPrefix('gx'))

  // Shared domain prefixes via registry (version-independent)
  for (const shared of ['manifest', 'georeference']) {
    const d = registry.domains.get(shared)
    if (d) prefixSet.add(`PREFIX ${d.prefix}: <${d.namespace}>`)
  }

  // Domain-specific prefixes (handles IRI-derived names like "openlabel"
  // that may differ from registry keys like "openlabel-v2")
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
 * Shape → sh:targetClass → C, C rdfs:subClassOf envited-x:Content → "Content"
 *
 * Falls back to "Content" if no shape group is found (conservative default).
 */
function classifyProperty(propName: string, domainName: string, vocabIndex: CompilerVocab): string {
  const shapeGroup = vocabIndex.shapeGroups.get(`${propName}:${domainName}`)
  return shapeGroup ?? 'Content'
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
 * patterns (sh:property paths, shape-group nesting, Range2D detection)
 * so checking only one would under-recognise valid properties.
 *
 * Used as the defense-in-depth filter in `partitionFiltersByDomain` —
 * unknown keys never reach SPARQL compilation.
 */
function isKnownProperty(propName: string, vocabIndex: CompilerVocab): boolean {
  if (vocabIndex.properties.has(propName)) return true
  if (vocabIndex.range2DProperties.has(propName)) return true
  // shapeGroups is keyed by `${localName}:${domain}` — any domain matches.
  for (const key of vocabIndex.shapeGroups.keys()) {
    if (key.startsWith(`${propName}:`)) return true
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
