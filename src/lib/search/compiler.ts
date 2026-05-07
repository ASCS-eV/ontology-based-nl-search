/**
 * Generic SPARQL Compiler — compiles SearchSlots into SPARQL SELECT queries.
 *
 * Design: Domain-agnostic. Uses the DomainRegistry to resolve target classes
 * and namespace prefixes. Generates FILTER clauses from slot filters/ranges.
 *
 * Architecture pattern: All ENVITED-X ontology domains follow a consistent
 * structure: Asset → hasDomainSpecification → (hasContent, hasFormat,
 * hasQuantity, hasQuality, hasDataSource, hasGeoreference).
 * This compiler exploits that regularity.
 *
 * @see https://www.w3.org/TR/sparql11-query/
 */
import { buildDomainRegistry } from '@/lib/ontology/domain-registry'
import { buildVocabularyIndex } from '@/lib/ontology/vocabulary-index'

import type { SearchSlots } from './slots'

/**
 * Compile structured search slots into a valid SPARQL SELECT query.
 * Resolves the target domain(s) from the registry and builds
 * appropriate graph patterns.
 */
export async function compileSlots(slots: SearchSlots): Promise<string> {
  const registry = await buildDomainRegistry()
  const vocabIndex = await buildVocabularyIndex()

  // Use first domain (multi-domain UNION queries are a future enhancement)
  const domainName = slots.domains[0] || 'hdmap'
  const domain = registry.domains.get(domainName)

  if (!domain) {
    throw new Error(`Unknown domain: ${domainName}. Available: ${registry.domainNames.join(', ')}`)
  }

  const prefixes = registry.prefixesFor(domainName)
  const patterns: string[] = []
  const filters: string[] = []
  const optionals: string[] = []
  const selectVars = new Set(['?asset', '?name'])

  // Base pattern — asset type + label
  patterns.push(`?asset a ${domain.targetClass} ;`)
  patterns.push('  rdfs:label ?name .')

  // Determine which sub-shapes are needed
  const filterEntries = Object.entries(slots.filters)
  const rangeEntries = Object.entries(slots.ranges)
  const hasLocationFilters = !!(
    slots.location?.country ||
    slots.location?.state ||
    slots.location?.region ||
    slots.location?.city
  )
  const needsDomSpec = filterEntries.length > 0 || rangeEntries.length > 0 || hasLocationFilters

  if (needsDomSpec) {
    patterns.push(`?asset ${domain.prefix}:hasDomainSpecification ?domSpec .`)
  }

  // Group properties by their SHACL shape (Content, Format, Quantity, DataSource)
  const contentProps: [string, string | string[]][] = []
  const formatProps: [string, string | string[]][] = []
  const quantityProps: [string, string | string[]][] = []
  const dataSourceProps: [string, string | string[]][] = []
  const otherProps: [string, string | string[]][] = []

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
      default:
        otherProps.push([propName, value])
    }
  }

  // Content shape
  if (contentProps.length > 0) {
    patterns.push(`?domSpec ${domain.prefix}:hasContent ?content .`)
    for (const [propName, value] of contentProps) {
      const varName = `?${propName}`
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)
      patterns.push(`?content ${propDomain}:${propName} ${varName} .`)
      addEnumFilter(filters, varName, value)
      selectVars.add(varName)
    }
  }

  // Format shape
  if (formatProps.length > 0) {
    patterns.push(`?domSpec ${domain.prefix}:hasFormat ?fmt .`)
    for (const [propName, value] of formatProps) {
      const actualPropName = propName === 'version' ? 'version' : propName
      const varName = `?${actualPropName}`
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)
      patterns.push(`?fmt ${propDomain}:${propName} ${varName} .`)
      addEnumFilter(filters, varName, value)
      selectVars.add(varName)
    }
  }

  // Quantity / range filters
  if (rangeEntries.length > 0) {
    patterns.push(`?domSpec ${domain.prefix}:hasQuantity ?qty .`)
    for (const [propName, range] of rangeEntries) {
      const varName = `?${propName}`
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)
      patterns.push(`?qty ${propDomain}:${propName} ${varName} .`)
      selectVars.add(varName)
      if (range.min !== undefined) {
        filters.push(`FILTER(xsd:float(${varName}) >= ${range.min})`)
      }
      if (range.max !== undefined) {
        filters.push(`FILTER(xsd:float(${varName}) <= ${range.max})`)
      }
    }
  }

  // DataSource shape
  if (dataSourceProps.length > 0) {
    patterns.push(`?domSpec ${domain.prefix}:hasDataSource ?ds .`)
    for (const [propName, value] of dataSourceProps) {
      const varName = `?${propName}`
      const propDomain = resolvePropertyDomain(propName, domainName, vocabIndex)
      patterns.push(`?ds ${propDomain}:${propName} ${varName} .`)
      addEnumFilter(filters, varName, value)
      selectVars.add(varName)
    }
  }

  // Georeference location filters
  if (hasLocationFilters && domain.hasGeoreference) {
    patterns.push(`?domSpec ${domain.prefix}:hasGeoreference ?georef .`)
    patterns.push('?georef georeference:hasProjectLocation ?loc .')

    if (slots.location!.country) {
      patterns.push('?loc georeference:country ?country .')
      filters.push(`FILTER(?country = "${slots.location!.country}")`)
      selectVars.add('?country')
    }
    if (slots.location!.state) {
      patterns.push('?loc georeference:state ?state .')
      filters.push(`FILTER(?state = "${slots.location!.state}")`)
      selectVars.add('?state')
    }
    if (slots.location!.region) {
      patterns.push('?loc georeference:region ?region .')
      filters.push(`FILTER(CONTAINS(LCASE(?region), "${slots.location!.region.toLowerCase()}"))`)
      selectVars.add('?region')
    }
    if (slots.location!.city) {
      patterns.push('?loc georeference:city ?city .')
      filters.push(`FILTER(CONTAINS(LCASE(?city), "${slots.location!.city.toLowerCase()}"))`)
      selectVars.add('?city')
    }
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
    const domain = registry.domains.get(domainName)!
    const prefixes = registry.prefixesFor(domainName)
    queries.push({
      domain: domainName,
      query: `${prefixes}\nSELECT (COUNT(DISTINCT ?asset) AS ?count) WHERE {\n  ?asset a ${domain.targetClass} .\n}`,
    })
  }

  return queries
}
