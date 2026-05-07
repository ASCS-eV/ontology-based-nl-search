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
