/**
 * Search slot types — the structured intermediate representation.
 * Domain-agnostic: slots are keyed by ontology property local names.
 *
 * The LLM or concept-matcher fills these; the compiler translates
 * them into SPARQL based on domain registry metadata.
 */

/** A single filter value with its ontology context */
export interface SlotValue {
  /** The actual value (e.g. an enum value or literal) */
  value: string
  /** Domain this property belongs to (the SHACL domain name) */
  domain: string
  /** Full IRI of the property */
  propertyIri: string
}

/**
 * Cross-reference filter — join this asset's references to another asset
 * domain. References nest: a filter may carry its own `references`, expressing
 * a chain through the graph. A nested form `[{ domain: 'child', references: [{
 * domain: 'grandchild' }] }]` (parent → child → grandchild) is distinct from
 * the flat two-reference form `[{ domain: 'child' }, { domain: 'grandchild' }]`
 * (parent → child AND parent → grandchild). Nested entries are AND-combined
 * like their siblings: the parent must reference all of them.
 */
export interface ReferenceFilter {
  /** Domain of the referenced asset */
  domain: string
  /** Optional label filter on the referenced asset */
  label?: string
  /**
   * Property filters that constrain the REFERENCED asset itself (not the
   * parent). Keyed by SHACL leaf local name — same shape as
   * {@link SearchSlots.filters}. Example: a parent referencing child assets
   * constrained by a property value →
   * `{ domain: 'child', filters: { '<property>': '<value>' } }`. The compiler
   * applies these to the reference's own variable, so the constraint binds to
   * the referenced asset, not the parent. Without this, a reference-scoped
   * constraint partitions to the top level and binds to the wrong domain.
   * Omitted/empty = no property constraint.
   */
  filters?: Record<string, string | string[]>
  /**
   * Numeric range filters that constrain the referenced asset — same shape as
   * {@link SearchSlots.ranges}. Example: referenced assets meeting a numeric
   * threshold → `{ ranges: { '<numericProperty>': { min: 1 } } }`.
   */
  ranges?: Record<string, { min?: number; max?: number }>
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
 */
export interface SearchSlots {
  /** Target domain(s) for the search (the SHACL domain name(s)) */
  domains: string[]
  /**
   * Property filters keyed by SHACL property local name. Values are
   * literal strings (or arrays for `IN (…)` semantics). Works for any
   * leaf in the schema — including geography, license, and any other
   * leaf the ontology declares.
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
   * Callers may pass a single {@link ReferenceFilter} object instead of
   * an array; `normalizeReferences` accepts both at the boundary.
   */
  references?: ReferenceFilter[]
}

/**
 * Normalize a references slot to an array. Accepts the array form, the
 * single-object form, or `undefined`/empty — so a submission or refine client
 * that sends one object keeps working. Empty/blank
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
 * UI can render. A multi-reference query yields one plan per reference.
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
  /**
   * Reference domains that could not be compiled because no traversal
   * path (SHACL chain, data-driven edge, or sibling edge) was found.
   * Callers can surface these as user-visible gaps/limitations.
   */
  droppedReferences?: string[]
}

/** Create empty slots targeting a specific domain */
export function createEmptySlots(domain: string): SearchSlots {
  return {
    domains: [domain],
    filters: {},
    ranges: {},
  }
}
