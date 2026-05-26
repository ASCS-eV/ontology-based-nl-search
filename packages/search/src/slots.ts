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
 * Cross-reference filter — join this asset's manifest references
 * to another asset domain.
 */
export interface ReferenceFilter {
  /** Domain of the referenced asset (e.g., "hdmap") */
  domain: string
  /** Optional label filter on the referenced asset */
  label?: string
}

/**
 * Generic search slots — property localName → value(s).
 *
 * Domain-agnostic by construction. The slot shape contains no
 * ontology-specific field names: every constraint the user expresses
 * — geography, license, references, anything else — flows through one
 * of the four generic buckets below, keyed by the SHACL property's
 * local name. The compiler walks the SHACL-discovered property path
 * for that key to emit the corresponding SPARQL pattern; ontologies
 * with different naming or shape depth need zero code changes.
 *
 * Enumerated properties (sh:in) accept the exact `sh:in` values.
 * Numeric properties go through `ranges` with `min`/`max` bounds.
 * IRI-valued properties (`sh:nodeKind sh:IRI`) accept either bare
 * IRI strings or literals, depending on the data.
 *
 * Historical note: prior versions carried a typed `location: {
 * country, state, region, city }` shape. Task 21d-flat removed it —
 * those field names were inherently ontology-specific (they only
 * exist in ontologies that import the ENVITED-X georeference shape).
 * Callers now place country/state/region/city under `filters` keyed
 * by the exact SHACL property local name, and the compiler discovers
 * the chain to each leaf.
 */
export interface SearchSlots {
  /** Target domain(s) for the search (e.g., ["hdmap"] or ["scenario"]) */
  domains: string[]
  /**
   * Property filters keyed by SHACL property local name. Values are
   * literal strings (or arrays for `IN (…)` semantics). Works for any
   * leaf in the schema — including geography, license, and other
   * fields that used to live in a typed sub-shape.
   */
  filters: Record<string, string | string[]>
  /** Numeric range filters: localName → { min?, max? } */
  ranges: Record<string, { min?: number; max?: number }>
  /**
   * Cross-reference filter — find assets that reference another
   * domain. Compiles to a SHACL-discovered chain (see
   * `buildReferenceChains`) — no specific predicate path is assumed.
   */
  references?: ReferenceFilter
}

/** Create empty slots targeting a specific domain */
export function createEmptySlots(domain: string): SearchSlots {
  return {
    domains: [domain],
    filters: {},
    ranges: {},
  }
}
