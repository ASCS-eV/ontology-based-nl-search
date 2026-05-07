import type { SearchSlots } from './slots'

const PREFIXES = `PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>
PREFIX georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX gx: <https://w3id.org/gaia-x/development#>`

/**
 * Compile structured search slots into a valid SPARQL SELECT query.
 * Only adds FILTER clauses for slots that have values.
 * Uses OPTIONAL for properties that may not exist on all assets.
 */
export function compileSlots(slots: SearchSlots): string {
  const patterns: string[] = []
  const filters: string[] = []
  const optionals: string[] = []
  const selectVars = new Set(['?asset', '?name'])

  // Base pattern — always present
  patterns.push('?asset a hdmap:HdMap ;')
  patterns.push('  rdfs:label ?name .')

  // Domain specification (needed for most filters)
  const needsDomSpec =
    slots.roadType ||
    slots.laneType ||
    slots.levelOfDetail ||
    slots.trafficDirection ||
    slots.formatType ||
    slots.formatVersion ||
    slots.dataSource ||
    slots.country ||
    slots.state ||
    slots.region ||
    slots.city ||
    slots.minLength ||
    slots.maxLength ||
    slots.minIntersections ||
    slots.minTrafficLights ||
    slots.minTrafficSigns ||
    slots.maxSpeedLimit ||
    slots.minSpeedLimit

  if (needsDomSpec) {
    patterns.push('?asset hdmap:hasDomainSpecification ?domSpec .')
  }

  // Content filters
  if (slots.roadType || slots.laneType || slots.levelOfDetail || slots.trafficDirection) {
    patterns.push('?domSpec hdmap:hasContent ?content .')

    if (slots.roadType) {
      patterns.push('?content hdmap:roadTypes ?roadTypes .')
      filters.push(`FILTER(?roadTypes = "${slots.roadType}")`)
      selectVars.add('?roadTypes')
    }
    if (slots.laneType) {
      patterns.push('?content hdmap:laneTypes ?laneTypes .')
      filters.push(`FILTER(?laneTypes = "${slots.laneType}")`)
      selectVars.add('?laneTypes')
    }
    if (slots.levelOfDetail) {
      patterns.push('?content hdmap:levelOfDetail ?lod .')
      filters.push(`FILTER(?lod = "${slots.levelOfDetail}")`)
      selectVars.add('?lod')
    }
    if (slots.trafficDirection) {
      patterns.push('?content hdmap:trafficDirection ?trafficDir .')
      filters.push(`FILTER(?trafficDir = "${slots.trafficDirection}")`)
      selectVars.add('?trafficDir')
    }
  }

  // Format filters
  if (slots.formatType || slots.formatVersion) {
    patterns.push('?domSpec hdmap:hasFormat ?fmt .')

    if (slots.formatType) {
      patterns.push('?fmt hdmap:formatType ?formatType .')
      filters.push(`FILTER(?formatType = "${slots.formatType}")`)
      selectVars.add('?formatType')
    }
    if (slots.formatVersion) {
      patterns.push('?fmt hdmap:version ?formatVersion .')
      filters.push(`FILTER(?formatVersion = "${slots.formatVersion}")`)
      selectVars.add('?formatVersion')
    }
  }

  // Georeference filters
  if (slots.country || slots.state || slots.region || slots.city) {
    patterns.push('?domSpec hdmap:hasGeoreference ?georef .')
    patterns.push('?georef georeference:hasProjectLocation ?loc .')

    if (slots.country) {
      patterns.push('?loc georeference:country ?country .')
      filters.push(`FILTER(?country = "${slots.country}")`)
      selectVars.add('?country')
    }
    if (slots.state) {
      patterns.push('?loc georeference:state ?state .')
      filters.push(`FILTER(?state = "${slots.state}")`)
      selectVars.add('?state')
    }
    if (slots.region) {
      patterns.push('?loc georeference:region ?region .')
      filters.push(`FILTER(CONTAINS(LCASE(?region), "${slots.region.toLowerCase()}"))`)
      selectVars.add('?region')
    }
    if (slots.city) {
      patterns.push('?loc georeference:city ?city .')
      filters.push(`FILTER(CONTAINS(LCASE(?city), "${slots.city.toLowerCase()}"))`)
      selectVars.add('?city')
    }
  }

  // Quantity filters
  if (
    slots.minLength ||
    slots.maxLength ||
    slots.minIntersections ||
    slots.minTrafficLights ||
    slots.minTrafficSigns ||
    slots.maxSpeedLimit ||
    slots.minSpeedLimit
  ) {
    patterns.push('?domSpec hdmap:hasQuantity ?qty .')

    if (slots.minLength || slots.maxLength) {
      patterns.push('?qty hdmap:length ?length .')
      selectVars.add('?length')
      if (slots.minLength) filters.push(`FILTER(xsd:float(?length) >= ${slots.minLength})`)
      if (slots.maxLength) filters.push(`FILTER(xsd:float(?length) <= ${slots.maxLength})`)
    }
    if (slots.minIntersections) {
      patterns.push('?qty hdmap:numberIntersections ?numIntersections .')
      filters.push(`FILTER(xsd:integer(?numIntersections) >= ${slots.minIntersections})`)
      selectVars.add('?numIntersections')
    }
    if (slots.minTrafficLights) {
      patterns.push('?qty hdmap:numberTrafficLights ?numTrafficLights .')
      filters.push(`FILTER(xsd:integer(?numTrafficLights) >= ${slots.minTrafficLights})`)
      selectVars.add('?numTrafficLights')
    }
    if (slots.minTrafficSigns) {
      patterns.push('?qty hdmap:numberTrafficSigns ?numTrafficSigns .')
      filters.push(`FILTER(xsd:integer(?numTrafficSigns) >= ${slots.minTrafficSigns})`)
      selectVars.add('?numTrafficSigns')
    }
    if (slots.maxSpeedLimit || slots.minSpeedLimit) {
      patterns.push('?qty hdmap:speedLimit ?speedLimit .')
      if (slots.maxSpeedLimit) {
        patterns.push('?speedLimit hdmap:max ?speedMax .')
        filters.push(`FILTER(xsd:float(?speedMax) <= ${slots.maxSpeedLimit})`)
        selectVars.add('?speedMax')
      }
      if (slots.minSpeedLimit) {
        patterns.push('?speedLimit hdmap:min ?speedMin .')
        filters.push(`FILTER(xsd:float(?speedMin) >= ${slots.minSpeedLimit})`)
        selectVars.add('?speedMin')
      }
    }
  }

  // Data source
  if (slots.dataSource) {
    patterns.push('?domSpec hdmap:hasDataSource ?ds .')
    patterns.push('?ds hdmap:usedDataSources ?dataSrc .')
    filters.push(`FILTER(?dataSrc = "${slots.dataSource}")`)
    selectVars.add('?dataSrc')
  }

  // License (via resource description)
  if (slots.license) {
    optionals.push(`OPTIONAL {
    ?asset hdmap:hasResourceDescription ?resDesc .
    ?resDesc gx:license ?license .
  }`)
    filters.push(`FILTER(?license = "${slots.license}")`)
    selectVars.add('?license')
  }

  // Build the query
  const selectClause = `SELECT ${[...selectVars].join(' ')}`
  const whereBody = [...patterns, ...optionals, ...filters].join('\n  ')

  return `${PREFIXES}
${selectClause} WHERE {
  ${whereBody}
}
LIMIT 100`
}
