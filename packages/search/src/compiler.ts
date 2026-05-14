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
import {
  buildDomainRegistry,
  type DomainDescriptor,
  type DomainRegistry,
} from '@ontology-search/ontology/domain-registry'

import { getInitializedStore } from './init.js'
import {
  queryAssetDomains,
  queryDomainReferences,
  queryPropertyDomains,
  queryPropertyShapeGroups,
  queryRange2DProperties,
} from './schema-queries.js'
import type { SearchSlots } from './slots.js'

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
}

/**
 * Escape a string value for safe embedding in a SPARQL double-quoted literal.
 * Prevents SPARQL injection by escaping characters that would break out of the literal.
 *
 * @see https://www.w3.org/TR/sparql11-query/#rString — SPARQL string escape rules
 */
export function escapeSparqlLiteral(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/** Cached compiler vocabulary (ontology doesn't change at runtime) */
let cachedCompilerVocab: CompilerVocab | null = null

/** Build the compiler vocabulary from the ontology schema graph using SPARQL queries */
async function getCompilerVocab(): Promise<CompilerVocab> {
  if (cachedCompilerVocab) return cachedCompilerVocab

  const store = await getInitializedStore()
  const [propertyDomains, shapeGroupInfos, range2DInfos] = await Promise.all([
    queryPropertyDomains(store),
    queryPropertyShapeGroups(store),
    queryRange2DProperties(store),
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

  cachedCompilerVocab = { properties, shapeGroups, range2DProperties }
  return cachedCompilerVocab
}

/** Cached asset domains (queried from ontology graph at startup) */
let cachedAssetDomains: Set<string> | null = null

/** Get all asset domains from the ontology graph */
export async function getAssetDomains(): Promise<Set<string>> {
  if (cachedAssetDomains) return cachedAssetDomains

  const store = await getInitializedStore()
  const domainInfos = await queryAssetDomains(store)
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
  const refs = await queryDomainReferences(store)
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
 * Compile structured search slots into a valid SPARQL SELECT query.
 * Resolves the target domain(s) from the registry and builds
 * appropriate graph patterns.
 *
 * When filters span multiple domains, identifies the primary (composite)
 * domain and generates a join via manifest:hasReferencedArtifacts.
 *
 * When no domain is specified and no filters exist, searches across ALL
 * asset types using envited-x:SimulationAsset superclass.
 */
export async function compileSlots(slots: SearchSlots): Promise<string> {
  const registry = await buildDomainRegistry()
  const vocabIndex = await getCompilerVocab()

  // When no domain is specified, use cross-domain search via SimulationAsset superclass
  if (slots.domains.length === 0) {
    return compileCrossDomainQuery(slots, registry)
  }

  const detectedDomains = slots.domains

  // Partition filters by domain
  const filtersByDomain = partitionFiltersByDomain(slots.filters, detectedDomains, vocabIndex)

  // Partition ranges by domain
  const rangesByDomain = partitionRangesByDomain(slots.ranges, detectedDomains, vocabIndex)

  // Determine primary domain — the one that references others, or the single domain
  const primaryDomain = await resolvePrimaryDomain(detectedDomains, filtersByDomain)
  const domain = registry.domains.get(primaryDomain)

  if (!domain) {
    throw new Error(
      `Unknown domain: ${primaryDomain}. Available: ${registry.domainNames.join(', ')}`
    )
  }

  // Collect all needed prefixes
  const prefixDomains = new Set([primaryDomain])
  for (const d of Object.keys(filtersByDomain)) {
    prefixDomains.add(d)
  }
  for (const d of Object.keys(rangesByDomain)) {
    prefixDomains.add(d)
  }
  const prefixes = buildPrefixes(registry, [...prefixDomains])

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
  buildDomainPatterns(
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
    '?asset',
    '?domSpec'
  )

  // Build cross-domain joins for referenced domains
  const allReferencedDomains = new Set([
    ...Object.keys(filtersByDomain).filter((d) => d !== primaryDomain),
    ...Object.keys(rangesByDomain).filter((d) => d !== primaryDomain),
  ])
  for (const refDomainName of allReferencedDomains) {
    const refDomain = registry.domains.get(refDomainName)
    if (!refDomain) continue

    const refFilters = filtersByDomain[refDomainName] || {}
    const refRanges = rangesByDomain[refDomainName] || {}
    if (Object.keys(refFilters).length === 0 && Object.keys(refRanges).length === 0) continue

    // Join via manifest → hasReferencedArtifacts
    const refVar = `?ref_${refDomainName.replace(/-/g, '_')}`
    const refSpecVar = `?refSpec_${refDomainName.replace(/-/g, '_')}`

    patterns.push(`?asset ${domain.prefix}:hasManifest ?manifest .`)
    patterns.push(`?manifest manifest:hasReferencedArtifacts ${refVar} .`)
    patterns.push(`${refVar} a ${refDomain.targetClass} .`)

    buildDomainPatterns(
      refDomainName,
      refDomain,
      refFilters,
      refRanges,
      undefined,
      patterns,
      filters,
      optionals,
      selectVars,
      vocabIndex,
      refVar,
      refSpecVar
    )
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

  // Build the query
  const selectClause = `SELECT ${[...selectVars].join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')

  return `${prefixes}
${selectClause} WHERE {
  ${whereBody}
}
LIMIT 100`
}

/**
 * Compile a cross-domain query using envited-x:SimulationAsset superclass.
 * Used when no specific domain is detected, or when domain ambiguity exists.
 * Searches across ALL asset types (hdmap, scenario, ositrace, etc.).
 * Filters are applied as OPTIONAL patterns since different domains have different properties.
 */
function compileCrossDomainQuery(slots: SearchSlots, registry: DomainRegistry): string {
  // Use registry to look up envited-x and georeference namespaces (no hardcoding)
  const envitedX = registry.domains.get('envited-x')
  const georef = registry.domains.get('georeference')
  const envitedXPrefix = envitedX ? `PREFIX envited-x: <${envitedX.namespace}>` : ''
  const georefPrefix = georef ? `PREFIX georeference: <${georef.namespace}>` : ''

  const prefixes = [
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
    'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
    'PREFIX gx: <https://w3id.org/gaia-x/development#>',
    envitedXPrefix,
    georefPrefix,
  ]
    .filter(Boolean)
    .join('\n')

  const patterns: string[] = []
  const filters: string[] = []
  const optionals: string[] = []
  const selectVars = ['?asset', '?name']

  // Base pattern — search all SimulationAsset instances
  patterns.push('?asset a envited-x:SimulationAsset ;')
  patterns.push('  rdfs:label ?name .')

  // Apply location filters if present
  if (
    slots.location &&
    (slots.location.country || slots.location.state || slots.location.region || slots.location.city)
  ) {
    optionals.push(`OPTIONAL {
    ?asset envited-x:hasDomainSpecification ?domSpec .
    ?domSpec envited-x:hasGeoreference ?georef .
    ?georef georeference:hasProjectLocation ?loc .`)

    if (slots.location.country) {
      optionals.push(`    ?loc georeference:country ?country .`)
      filters.push(
        `  FILTER(CONTAINS(LCASE(?country), "${escapeSparqlLiteral(slots.location.country.toLowerCase())}"))`
      )
      selectVars.push('?country')
    }
    if (slots.location.city) {
      optionals.push(`    ?loc georeference:city ?city .`)
      filters.push(
        `  FILTER(CONTAINS(LCASE(?city), "${escapeSparqlLiteral(slots.location.city.toLowerCase())}"))`
      )
      selectVars.push('?city')
    }

    optionals.push(`  }`)
  }

  // License filter if specified
  if (slots.license) {
    optionals.push(`OPTIONAL {
    ?asset envited-x:hasResourceDescription ?resDesc .
    ?resDesc gx:license ?license .
  }`)
    filters.push(`FILTER(?license = "${escapeSparqlLiteral(slots.license)}")`)
    selectVars.push('?license')
  }

  // Build the query
  const selectClause = `SELECT ${selectVars.join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')

  return `${prefixes}
${selectClause} WHERE {
  ${whereBody}
}
LIMIT 100`
}

/**
 * Build patterns for a single domain's filters within the DomainSpecification structure.
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
  assetVar: string,
  specVar: string
): void {
  const filterEntries = Object.entries(domainFilters)
  const rangeEntries = Object.entries(ranges)
  const hasLocationFilters = !!(
    location?.country ||
    location?.state ||
    location?.region ||
    location?.city
  )
  const needsDomSpec = filterEntries.length > 0 || rangeEntries.length > 0 || hasLocationFilters

  if (!needsDomSpec) return

  patterns.push(`${assetVar} ${domain.prefix}:hasDomainSpecification ${specVar} .`)

  // Group by shape
  const contentProps: [string, string | string[]][] = []
  const formatProps: [string, string | string[]][] = []
  const quantityProps: [string, string | string[]][] = []
  const dataSourceProps: [string, string | string[]][] = []

  for (const [propName, value] of filterEntries) {
    const shape = classifyProperty(propName, domainName, vocabIndex)

    switch (shape) {
      case 'Content':
        contentProps.push([propName, value])
        break
      case 'Format':
        formatProps.push([propName, value])
        break
      case 'Quantity':
        quantityProps.push([propName, value])
        break
      case 'DataSource':
        dataSourceProps.push([propName, value])
        break
    }
  }

  const suffix = assetVar === '?asset' ? '' : `_${domainName.replace(/-/g, '_')}`

  // Content shape
  if (contentProps.length > 0) {
    const contentVar = `?content${suffix}`
    patterns.push(`${specVar} ${domain.prefix}:hasContent ${contentVar} .`)
    for (const [propName, value] of contentProps) {
      const varName = `?${propName}${suffix}`
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)
      patterns.push(`${contentVar} ${propDomain}:${propName} ${varName} .`)
      addEnumFilter(patterns, filters, varName, value)
      selectVars.add(varName)
    }
  }

  // Format shape
  if (formatProps.length > 0) {
    const fmtVar = `?fmt${suffix}`
    patterns.push(`${specVar} ${domain.prefix}:hasFormat ${fmtVar} .`)
    for (const [propName, value] of formatProps) {
      const varName = `?${propName}${suffix}`
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)
      patterns.push(`${fmtVar} ${propDomain}:${propName} ${varName} .`)
      addEnumFilter(patterns, filters, varName, value)
      selectVars.add(varName)
    }
  }

  // Quantity / range filters
  // Range2D properties (detected from SHACL via sh:node → Range2DShape) use
  // nested min/max structure: prop → [a Range2D; domain:min; domain:max]

  if (rangeEntries.length > 0) {
    const qtyVar = `?qty${suffix}`
    patterns.push(`${specVar} ${domain.prefix}:hasQuantity ${qtyVar} .`)
    for (const [propName, range] of rangeEntries) {
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)

      if (vocabIndex.range2DProperties.has(propName)) {
        // Range2D: property links to blank node with hdmap:min and hdmap:max
        const rangeNode = `?${propName}Range${suffix}`
        patterns.push(`${qtyVar} ${propDomain}:${propName} ${rangeNode} .`)
        if (range.min !== undefined) {
          const maxVar = `?${propName}Max${suffix}`
          patterns.push(`${rangeNode} ${propDomain}:max ${maxVar} .`)
          filters.push(`FILTER(xsd:float(${maxVar}) >= ${range.min})`)
          selectVars.add(maxVar)
        }
        if (range.max !== undefined) {
          const minVar = `?${propName}Min${suffix}`
          patterns.push(`${rangeNode} ${propDomain}:min ${minVar} .`)
          filters.push(`FILTER(xsd:float(${minVar}) <= ${range.max})`)
          selectVars.add(minVar)
        }
      } else {
        // Simple literal property
        const varName = `?${propName}${suffix}`
        patterns.push(`${qtyVar} ${propDomain}:${propName} ${varName} .`)
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

  // DataSource shape
  if (dataSourceProps.length > 0) {
    const dsVar = `?ds${suffix}`
    patterns.push(`${specVar} ${domain.prefix}:hasDataSource ${dsVar} .`)
    for (const [propName, value] of dataSourceProps) {
      const varName = `?${propName}${suffix}`
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)
      patterns.push(`${dsVar} ${propDomain}:${propName} ${varName} .`)
      addEnumFilter(patterns, filters, varName, value)
      selectVars.add(varName)
    }
  }

  // Georeference location filters
  if (hasLocationFilters && domain.hasGeoreference) {
    const georefVar = `?georef${suffix}`
    const locVar = `?loc${suffix}`
    patterns.push(`${specVar} ${domain.prefix}:hasGeoreference ${georefVar} .`)
    patterns.push(`${georefVar} georeference:hasProjectLocation ${locVar} .`)

    if (location!.country) {
      const v = `?country${suffix}`
      patterns.push(`${locVar} georeference:country ${v} .`)
      filters.push(
        `FILTER(CONTAINS(LCASE(${v}), "${escapeSparqlLiteral(location!.country.toLowerCase())}"))`
      )
      selectVars.add(v)
    }
    if (location!.state) {
      const v = `?state${suffix}`
      patterns.push(`${locVar} georeference:state ${v} .`)
      filters.push(`FILTER(${v} = "${escapeSparqlLiteral(location!.state)}")`)
      selectVars.add(v)
    }
    if (location!.region) {
      const v = `?region${suffix}`
      patterns.push(`${locVar} georeference:region ${v} .`)
      filters.push(
        `FILTER(CONTAINS(LCASE(${v}), "${escapeSparqlLiteral(location!.region.toLowerCase())}"))`
      )
      selectVars.add(v)
    }
    if (location!.city) {
      const v = `?city${suffix}`
      patterns.push(`${locVar} georeference:city ${v} .`)
      filters.push(
        `FILTER(CONTAINS(LCASE(${v}), "${escapeSparqlLiteral(location!.city.toLowerCase())}"))`
      )
      selectVars.add(v)
    }
  }
}

/**
 * Partition filters into per-domain groups based on ontology graph.
 * Uses the ontology's property definitions to determine which domain each filter belongs to.
 * Handles properties that exist in multiple domains by checking against detected domains.
 */
function partitionFiltersByDomain(
  filters: Record<string, string | string[]>,
  detectedDomains: string[],
  vocabIndex: { properties: Map<string, CompilerProperty> }
): Record<string, Record<string, string | string[]>> {
  const result: Record<string, Record<string, string | string[]>> = {}

  // Single domain — all filters belong to it
  if (detectedDomains.length === 1) {
    result[detectedDomains[0]!] = { ...filters }
    return result
  }

  // Multi-domain: use ontology to find which detected domain owns each property
  for (const [propName, value] of Object.entries(filters)) {
    const propInfo = vocabIndex.properties.get(propName)

    if (!propInfo) {
      // Unknown property — skip (will be caught by validator)
      continue
    }

    // Find which detected domain defines this property
    const matchingDomain = detectedDomains.find((d) => propInfo.domains.has(d))

    if (matchingDomain) {
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
  vocabIndex: { properties: Map<string, CompilerProperty> }
): Record<string, Record<string, { min?: number; max?: number }>> {
  const result: Record<string, Record<string, { min?: number; max?: number }>> = {}

  // Single domain — all ranges belong to it
  if (detectedDomains.length === 1) {
    result[detectedDomains[0]!] = { ...ranges }
    return result
  }

  // Multi-domain: use ontology to find which detected domain owns each property
  for (const [propName, range] of Object.entries(ranges)) {
    const propInfo = vocabIndex.properties.get(propName)

    if (!propInfo) {
      // Unknown property — skip (will be caught by validator)
      continue
    }

    // Find which detected domain defines this property
    const matchingDomain = detectedDomains.find((d) => propInfo.domains.has(d))

    if (matchingDomain) {
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
    throw new Error('No domains detected - cannot compile query')
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
  prefixSet.add('PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>')
  prefixSet.add('PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>')
  prefixSet.add('PREFIX gx: <https://w3id.org/gaia-x/development#>')

  // Shared domain prefixes via registry (version-independent)
  for (const shared of ['manifest', 'georeference']) {
    const d = registry.domains.get(shared)
    if (d) prefixSet.add(`PREFIX ${d.prefix}: <${d.namespace}>`)
  }

  // Domain-specific prefixes
  for (const domainName of domains) {
    const domain = registry.domains.get(domainName)
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
 * Resolve which domain prefix owns a property.
 *
 * Strategy: Properties can exist in multiple domains (e.g., roadTypes in both hdmap and ositrace).
 * We use the target domain's prefix if the property exists there, otherwise use the property's
 * actual domain from the vocabulary index.
 */
function resolvePropertyDomain(
  propName: string,
  targetDomain: string,
  vocabIndex: { properties: Map<string, CompilerProperty> }
): string {
  const propInfo = vocabIndex.properties.get(propName)

  // If the property doesn't exist in vocabulary, use target domain
  if (!propInfo) return targetDomain

  // If the property exists in the target domain, use it
  if (propInfo.domains.has(targetDomain)) return targetDomain

  // Otherwise use the first domain where this property is defined
  const firstDomain = propInfo.domains.values().next().value
  return firstDomain || targetDomain
}

/**
 * Detect whether a filter value is an absolute IRI (http(s)://… or urn:…).
 * Used to decide between literal equality and hierarchy expansion.
 */
function isIri(value: string): boolean {
  return /^https?:\/\//.test(value) || /^urn:/.test(value)
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
const HIERARCHY_EXPANSION_PATH =
  '(<http://www.w3.org/2004/02/skos/core#broaderTransitive>|<http://www.w3.org/2000/01/rdf-schema#subClassOf>)*'

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
    throw new Error(`Unknown domain: ${domainName}`)
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
