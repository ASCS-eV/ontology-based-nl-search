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
 * Cross-reference filter — join this asset's manifest references to another
 * asset domain. References nest: a filter may carry its own `references`,
 * expressing a chain through the graph. "scenarios derived from traces with
 * maps" → `[{ domain: 'ositrace', references: [{ domain: 'hdmap' }] }]`
 * (scenario → trace → map), distinct from the flat two-reference form
 * `[{ domain: 'ositrace' }, { domain: 'hdmap' }]` (scenario → trace AND
 * scenario → map). Nested entries are AND-combined like their siblings: the
 * parent must reference all of them.
 */
export interface ReferenceFilter {
  /** Domain of the referenced asset (e.g., "hdmap") */
  domain: string
  /** Optional label filter on the referenced asset */
  label?: string
  /**
   * Further references the *referenced* asset must itself carry. Each is a
   * chain one hop deeper (parent ref → this domain). Omitted/empty = leaf.
   */
  references?: ReferenceFilter[]
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
   * Cross-reference filters — find assets that reference one or more other
   * domains. Each entry compiles to a SHACL-discovered JOIN (see
   * `buildReferenceChains`); multiple entries are AND-combined (the asset must
   * reference all of them). The first entry's referenced asset is projected
   * (and drives the per-row breadcrumb); additional entries are filter-only.
   *
   * Legacy callers may pass a single {@link ReferenceFilter} object instead of
   * an array; `normalizeReferences` accepts both at the boundary.
   */
  references?: ReferenceFilter[]
}

/**
 * Normalize a references slot to an array. Accepts the current array form, the
 * legacy single-object form, or `undefined`/empty — so an older LLM submission
 * or refine client that still sends one object keeps working. Empty/blank
 * domains are dropped.
 */
export function normalizeReferences(
  input: ReferenceFilter | ReferenceFilter[] | undefined
): ReferenceFilter[] {
  if (!input) return []
  const arr = Array.isArray(input) ? input : [input]
  return arr
    .filter((r): r is ReferenceFilter => Boolean(r?.domain?.trim()))
    .map((r) => {
      const nested = normalizeReferences(r.references)
      if (nested.length > 0) return { ...r, references: nested }
      // No valid nested refs: strip an empty `references` key so leaf nodes
      // stay exactly `{ domain, label? }` (keeps equality/snapshots stable).
      if (r.references !== undefined) {
        const { references: _drop, ...leaf } = r
        return leaf
      }
      return r
    })
}

/**
 * One step in the cross-reference path the compiler emitted. The
 * combination of (predicate, variable) lets the service later read each
 * row's binding for `variable` and pair it with `predicate` to display a
 * breadcrumb of the traversal.
 */
export interface TraceabilityStep {
  /**
   * SPARQL variable bound to this step's RDF node, *without* the leading
   * `?` (e.g. `"ref_step_1"`, `"refAsset"`). The service looks up this
   * key in the binding to find the intermediate IRI/blank-node at runtime.
   */
  variable: string
  /** Full predicate IRI used to reach this step from the previous one. */
  predicate: string
}

/**
 * Compile-time plan describing one cross-reference JOIN the compiler emitted.
 * The service uses it to reconstruct a per-row traceability chain from the
 * bound variables — turning a flat result set into an ordered breadcrumb the
 * UI can render (WP3). A multi-reference query yields one plan per reference.
 */
export interface TraceabilityPlan {
  /** SPARQL variable name (no `?`) anchoring the chain — typically `"asset"`. */
  sourceVariable: string
  /**
   * The projected referenced-asset variable this chain leads to, without the
   * leading `?` (e.g. `"refAsset"`, `"refAsset1"`). The service keys each
   * row's breadcrumb by this so the UI can attach the chain to the matching
   * referenced-asset pill.
   */
  targetVariable: string
  /** Steps in traversal order. The last step's `variable` is the joined child. */
  steps: TraceabilityStep[]
}

/**
 * Return type of {@link compileSlots}. `sparql` is the executable query;
 * `trace` carries one {@link TraceabilityPlan} per projected cross-reference
 * (present only when the query contains a reference JOIN). Callers that don't
 * care about traceability simply destructure `{ sparql }` and ignore the rest.
 */
export interface CompileResult {
  sparql: string
  trace?: TraceabilityPlan[]
}

/** Create empty slots targeting a specific domain */
export function createEmptySlots(domain: string): SearchSlots {
  return {
    domains: [domain],
    filters: {},
    ranges: {},
  }
}
