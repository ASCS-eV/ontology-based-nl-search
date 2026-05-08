/**
 * Generic SPARQL Compiler — compiles SearchSlots into SPARQL SELECT queries.
 *
 * Design: Domain-agnostic. Uses the DomainRegistry to resolve target classes
 * and namespace prefixes. Generates FILTER clauses from slot filters/ranges.
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
} from '@ontology-search/ontology/domain-registry'

import { getInitializedStore } from './init.js'
import type { SearchSlots } from './slots.js'
import { extractVocabulary } from './vocabulary-extractor.js'

/** Minimal property info needed by the compiler */
interface CompilerProperty {
  domain: string
  iri: string
}

interface CompilerVocab {
  properties: Map<string, CompilerProperty>
}

/** Cached compiler vocabulary (ontology doesn't change at runtime) */
let cachedCompilerVocab: CompilerVocab | null = null

/** Build the compiler vocabulary from the ontology schema graph */
async function getCompilerVocab(): Promise<CompilerVocab> {
  if (cachedCompilerVocab) return cachedCompilerVocab

  const store = await getInitializedStore()
  const vocabulary = await extractVocabulary(store)
  const properties = new Map<string, CompilerProperty>()

  for (const prop of vocabulary.enumProperties) {
    properties.set(prop.localName, { domain: prop.domain, iri: prop.iri })
  }
  for (const prop of vocabulary.numericProperties) {
    properties.set(prop.localName, { domain: prop.domain, iri: prop.iri })
  }

  cachedCompilerVocab = { properties }
  return cachedCompilerVocab
}

/**
 * Domains that represent actual searchable asset types.
 * Excludes supporting ontologies (georeference, manifest, gx, openlabel, envited-x, general).
 */
export const ASSET_DOMAINS = new Set([
  'automotive-simulator',
  'environment-model',
  'hdmap',
  'leakage-test',
  'ositrace',
  'scenario',
  'service',
  'simulated-sensor',
  'simulation-model',
  'surface-model',
  'survey',
  'tzip21',
  'vv-report',
])

/**
 * Domain hierarchy: which domains can reference which others.
 * Derived from SHACL: scenario's manifest can reference hdmap and environment-model.
 * This relationship allows cross-domain queries (scenario that uses an hdmap with X).
 */
const DOMAIN_REFERENCES: Record<string, string[]> = {
  scenario: ['hdmap', 'environment-model'],
}

/**
 * Compile structured search slots into a valid SPARQL SELECT query.
 * Resolves the target domain(s) from the registry and builds
 * appropriate graph patterns.
 *
 * When filters span multiple domains, identifies the primary (composite)
 * domain and generates a join via manifest:hasReferencedArtifacts.
 */
export async function compileSlots(slots: SearchSlots): Promise<string> {
  const registry = await buildDomainRegistry()
  const vocabIndex = await getCompilerVocab()

  const detectedDomains = slots.domains.length > 0 ? slots.domains : ['hdmap']

  // Partition filters by domain
  const filtersByDomain = partitionFiltersByDomain(slots.filters, detectedDomains, vocabIndex)

  // Partition ranges by domain
  const rangesByDomain = partitionRangesByDomain(slots.ranges, detectedDomains, vocabIndex)

  // Determine primary domain — the one that references others, or the single domain
  const primaryDomain = resolvePrimaryDomain(detectedDomains, filtersByDomain)
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

    patterns.push(
      `?asset ${primaryDomain === 'scenario' ? 'scenario' : domain.prefix}:hasManifest ?manifest .`
    )
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
    filters.push(`FILTER(?license = "${slots.license}")`)
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
  vocabIndex: { properties: Map<string, { domain: string; iri: string }> },
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
    const vocabProp = vocabIndex.properties.get(propName)
    const shape = classifyProperty(propName, vocabProp?.iri || '')

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
      addEnumFilter(filters, varName, value)
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
      addEnumFilter(filters, varName, value)
      selectVars.add(varName)
    }
  }

  // Quantity / range filters
  // Some properties (e.g., speedLimit) use Range2D structure: prop → [a Range2D; hdmap:min; hdmap:max]
  const range2DProperties = new Set(['speedLimit'])

  if (rangeEntries.length > 0) {
    const qtyVar = `?qty${suffix}`
    patterns.push(`${specVar} ${domain.prefix}:hasQuantity ${qtyVar} .`)
    for (const [propName, range] of rangeEntries) {
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)

      if (range2DProperties.has(propName)) {
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
      addEnumFilter(filters, varName, value)
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
      filters.push(`FILTER(CONTAINS(LCASE(${v}), "${location!.country.toLowerCase()}"))`)
      selectVars.add(v)
    }
    if (location!.state) {
      const v = `?state${suffix}`
      patterns.push(`${locVar} georeference:state ${v} .`)
      filters.push(`FILTER(${v} = "${location!.state}")`)
      selectVars.add(v)
    }
    if (location!.region) {
      const v = `?region${suffix}`
      patterns.push(`${locVar} georeference:region ${v} .`)
      filters.push(`FILTER(CONTAINS(LCASE(${v}), "${location!.region.toLowerCase()}"))`)
      selectVars.add(v)
    }
    if (location!.city) {
      const v = `?city${suffix}`
      patterns.push(`${locVar} georeference:city ${v} .`)
      filters.push(`FILTER(CONTAINS(LCASE(${v}), "${location!.city.toLowerCase()}"))`)
      selectVars.add(v)
    }
  }
}

/**
 * Partition filters into per-domain groups based on vocabulary index.
 * Each filter property is assigned to the domain that defines it.
 *
 * Strategy: If only one domain is detected, all filters go to that domain
 * (properties like formatType exist in every domain). Cross-domain partition
 * only happens when multiple domains are explicitly detected.
 */
function partitionFiltersByDomain(
  filters: Record<string, string | string[]>,
  detectedDomains: string[],
  vocabIndex: { properties: Map<string, { domain: string }> }
): Record<string, Record<string, string | string[]>> {
  const result: Record<string, Record<string, string | string[]>> = {}
  const defaultDomain = detectedDomains[0] || 'hdmap'

  // Single domain — all filters belong to it (no cross-domain partition)
  if (detectedDomains.length <= 1) {
    result[defaultDomain] = { ...filters }
    return result
  }

  // Multi-domain: assign each property to its owning domain
  for (const [propName, value] of Object.entries(filters)) {
    const prop = vocabIndex.properties.get(propName)
    let domain = defaultDomain

    if (prop && detectedDomains.includes(prop.domain)) {
      domain = prop.domain
    } else if (prop && prop.domain !== 'georeference') {
      // Property belongs to a domain not in detected list — use it anyway
      domain = prop.domain
    }

    if (!result[domain]) result[domain] = {}
    result[domain]![propName] = value
  }

  // Ensure at least the default domain is represented
  if (Object.keys(result).length === 0) {
    result[defaultDomain] = {}
  }

  return result
}

/**
 * Partition ranges into per-domain groups based on vocabulary index.
 * Similar to partitionFiltersByDomain but for numeric range properties.
 */
function partitionRangesByDomain(
  ranges: Record<string, { min?: number; max?: number }>,
  detectedDomains: string[],
  vocabIndex: { properties: Map<string, { domain: string }> }
): Record<string, Record<string, { min?: number; max?: number }>> {
  const result: Record<string, Record<string, { min?: number; max?: number }>> = {}
  const defaultDomain = detectedDomains[0] || 'hdmap'

  if (detectedDomains.length <= 1) {
    result[defaultDomain] = { ...ranges }
    return result
  }

  for (const [propName, range] of Object.entries(ranges)) {
    const prop = vocabIndex.properties.get(propName)
    let domain = defaultDomain

    if (prop && detectedDomains.includes(prop.domain)) {
      domain = prop.domain
    } else if (prop && prop.domain !== 'georeference') {
      domain = prop.domain
    }

    if (!result[domain]) result[domain] = {}
    result[domain]![propName] = range
  }

  return result
}

/**
 * Determine the primary domain — the composite one that references others.
 * E.g., if we have both 'scenario' and 'hdmap' filters, scenario is primary
 * because scenarios reference hdmaps.
 */
function resolvePrimaryDomain(
  detectedDomains: string[],
  filtersByDomain: Record<string, Record<string, string | string[]>>
): string {
  const allDomains = new Set([...detectedDomains, ...Object.keys(filtersByDomain)])

  // Check if any domain references others that are present
  for (const [parent, children] of Object.entries(DOMAIN_REFERENCES)) {
    if (allDomains.has(parent) && children.some((c) => allDomains.has(c))) {
      return parent
    }
  }

  // Otherwise pick the first detected domain
  return detectedDomains[0] || 'hdmap'
}

/**
 * Build the PREFIX block for a set of domains.
 */
function buildPrefixes(
  registry: Awaited<ReturnType<typeof buildDomainRegistry>>,
  domains: string[]
): string {
  const prefixSet = new Set<string>()

  // Always include shared prefixes
  prefixSet.add('PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>')
  prefixSet.add('PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>')
  prefixSet.add('PREFIX gx: <https://w3id.org/gaia-x/development#>')
  prefixSet.add('PREFIX manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/>')
  prefixSet.add('PREFIX georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/>')

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
 * Uses naming conventions from the ENVITED-X ontology structure.
 */
function classifyProperty(propName: string, _iri: string): string {
  // Format-related properties
  const formatProps = new Set(['formatType', 'version', 'formatVersion'])
  if (formatProps.has(propName)) return 'Format'

  // DataSource-related properties
  const dataSourceProps = new Set(['usedDataSources', 'sourceType', 'sourceDescription'])
  if (dataSourceProps.has(propName)) return 'DataSource'

  // Quantity-related (numeric properties)
  const quantityProps = new Set([
    'length',
    'numberIntersections',
    'numberTrafficLights',
    'numberTrafficSigns',
    'speedLimit',
    'temporaryTrafficObjects',
    'numberTrafficObjects',
    'permanentTrafficObjects',
    'numberOfEntities',
    'duration',
  ])
  if (quantityProps.has(propName)) return 'Quantity'

  // Default: Content shape (most enum properties live here)
  return 'Content'
}

/**
 * Resolve which domain prefix owns a property.
 *
 * Strategy: Properties in ENVITED-X follow the convention that each domain
 * defines its own properties in its own namespace. Common properties like
 * "length" exist in multiple domains (hdmap, surface-model, etc.).
 * We use the target domain's prefix unless the vocabulary index says
 * this specific property only exists in a different domain.
 */
function resolvePropertyDomain(
  propName: string,
  targetDomain: string,
  vocabIndex: { properties: Map<string, { domain: string }> }
): string {
  const prop = vocabIndex.properties.get(propName)
  // If the property doesn't exist in vocabulary, use target domain
  if (!prop) return targetDomain
  // If the property belongs to the target domain, use it
  if (prop.domain === targetDomain) return targetDomain
  // For shared properties like georeference ones, use the actual domain
  if (prop.domain === 'georeference') return prop.domain
  // Default: use the target domain (each domain has its own copy of common properties)
  return targetDomain
}

/**
 * Add a FILTER clause for enum values (string equality or IN for arrays).
 */
function addEnumFilter(filters: string[], varName: string, value: string | string[]): void {
  if (Array.isArray(value)) {
    if (value.length === 1) {
      filters.push(`FILTER(${varName} = "${value[0]}")`)
    } else {
      const values = value.map((v) => `"${v}"`).join(', ')
      filters.push(`FILTER(${varName} IN (${values}))`)
    }
  } else {
    filters.push(`FILTER(${varName} = "${value}")`)
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
  const queries: { domain: string; query: string }[] = []

  for (const domainName of registry.domainNames) {
    if (!ASSET_DOMAINS.has(domainName)) continue
    const domain = registry.domains.get(domainName)!
    const prefixes = registry.prefixesFor(domainName)
    queries.push({
      domain: domainName,
      query: `${prefixes}\nSELECT (COUNT(DISTINCT ?asset) AS ?count) WHERE {\n  ?asset a ${domain.targetClass} .\n}`,
    })
  }

  return queries
}
