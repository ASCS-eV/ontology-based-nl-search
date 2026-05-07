/**
 * Search slot types — the structured intermediate representation.
 * Domain-agnostic: slots are keyed by ontology property local names.
 *
 * The LLM or concept-matcher fills these; the compiler translates
 * them into SPARQL based on domain registry metadata.
 */

/** A single filter value with its ontology context */
export interface SlotValue {
  /** The actual value (e.g., "motorway", "ASAM OpenDRIVE") */
  value: string
  /** Domain this property belongs to (e.g., "hdmap", "scenario") */
  domain: string
  /** Full IRI of the property */
  propertyIri: string
}

/**
 * Generic search slots — property localName → value(s).
 * Works for any ontology domain without domain-specific interfaces.
 *
 * Enumerated properties (sh:in) use exact string values.
 * Numeric properties use comparison operators in the key suffix:
 *   "length__gte" → length >= value
 *   "length__lte" → length <= value
 */
export interface SearchSlots {
  /** Target domain(s) for the search (e.g., ["hdmap"] or ["scenario"]) */
  domains: string[]
  /** Property filters: localName → value or values */
  filters: Record<string, string | string[]>
  /** Numeric range filters: localName → { min?, max? } */
  ranges: Record<string, { min?: number; max?: number }>
  /** Free-text location filters (fallback for geo concepts) */
  location?: {
    country?: string
    state?: string
    region?: string
    city?: string
  }
  /** License filter */
  license?: string
}

/** Create empty slots targeting a specific domain */
export function createEmptySlots(domain: string): SearchSlots {
  return {
    domains: [domain],
    filters: {},
    ranges: {},
  }
}

/** Legacy slot interface for backward compatibility during migration */
export interface LegacySearchSlots {
  country?: string
  state?: string
  region?: string
  city?: string
  roadType?: string
  laneType?: string
  levelOfDetail?: string
  trafficDirection?: string
  formatType?: string
  formatVersion?: string
  dataSource?: string
  license?: string
  minLength?: number
  maxLength?: number
  minIntersections?: number
  minTrafficLights?: number
  minTrafficSigns?: number
  maxSpeedLimit?: number
  minSpeedLimit?: number
}

/**
 * Convert legacy hdmap-specific slots to the generic format.
 * Used during the transition period until all callers are updated.
 */
export function fromLegacySlots(legacy: LegacySearchSlots): SearchSlots {
  const slots: SearchSlots = {
    domains: ['hdmap'],
    filters: {},
    ranges: {},
  }

  // Enum filters
  if (legacy.roadType) slots.filters.roadTypes = legacy.roadType
  if (legacy.laneType) slots.filters.laneTypes = legacy.laneType
  if (legacy.levelOfDetail) slots.filters.levelOfDetail = legacy.levelOfDetail
  if (legacy.trafficDirection) slots.filters.trafficDirection = legacy.trafficDirection
  if (legacy.formatType) slots.filters.formatType = legacy.formatType
  if (legacy.formatVersion) slots.filters.version = legacy.formatVersion
  if (legacy.dataSource) slots.filters.usedDataSources = legacy.dataSource

  // Numeric ranges
  if (legacy.minLength || legacy.maxLength) {
    slots.ranges.length = { min: legacy.minLength, max: legacy.maxLength }
  }
  if (legacy.minIntersections) {
    slots.ranges.numberIntersections = { min: legacy.minIntersections }
  }
  if (legacy.minTrafficLights) {
    slots.ranges.numberTrafficLights = { min: legacy.minTrafficLights }
  }
  if (legacy.minTrafficSigns) {
    slots.ranges.numberTrafficSigns = { min: legacy.minTrafficSigns }
  }
  if (legacy.maxSpeedLimit || legacy.minSpeedLimit) {
    slots.ranges.speedLimit = { min: legacy.minSpeedLimit, max: legacy.maxSpeedLimit }
  }

  // Location
  if (legacy.country || legacy.state || legacy.region || legacy.city) {
    slots.location = {
      country: legacy.country,
      state: legacy.state,
      region: legacy.region,
      city: legacy.city,
    }
  }

  // License
  if (legacy.license) slots.license = legacy.license

  return slots
}
