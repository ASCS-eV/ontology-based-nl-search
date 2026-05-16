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
  /**
   * Location filters. Each field accepts a single value or an array — arrays
   * compile to `FILTER(?v IN (...))` so the LLM can express a region as the
   * explicit list of country/state/city codes it covers, instead of silently
   * collapsing to a single representative. SHACL validates each element; bad
   * elements drop and emit gaps, survivors stay.
   */
  location?: {
    country?: string | string[]
    state?: string | string[]
    region?: string | string[]
    city?: string | string[]
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
