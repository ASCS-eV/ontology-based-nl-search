/**
 * HTTP-boundary wire types.
 *
 * Single source of truth for the JSON shapes the API server emits and
 * the web client consumes over the `/search/stream` SSE stream and the
 * `/search/refine` / `/stats` JSON endpoints.
 *
 * **Zero workspace dependencies on purpose.** The web app cannot pull
 * in `@ontology-search/search` (it transitively brings Oxigraph WASM,
 * Node `fs`, and the SHACL validator). Keeping the wire shapes in
 * their own browser-safe package lets both sides of the HTTP boundary
 * import the SAME declarations — drift is impossible by construction.
 *
 * Server-internal extensions (e.g. `LlmStructuredResponse` which
 * carries `core/logging` `TimingEntry`s) live in the search package
 * and re-use these types as their HTTP surface.
 *
 * These are wire-format types, not ontology-specific identifiers.
 * Criterion 9b (ontology-name budget) does not apply.
 */

/** A single term mapped from user input to an ontology concept. */
export interface MappedTerm {
  /** What the user typed or implied. */
  input: string
  /** The ontology concept it maps to. */
  mapped: string
  /** How confidently the term was mapped. */
  confidence: 'high' | 'medium' | 'low'
  /** The ontology property/class used (e.g., `georeference:country`). */
  property?: string
}

/**
 * Why a part of the user's query was not turned into a filter. The `kind`
 * separates genuinely-different situations the UI previously lumped under one
 * "Not in ontology" heading:
 *
 *  - `unmapped`    — a term with no ontology counterpart (the original meaning).
 *  - `recognized`  — a real ontology concept the system understood but couldn't
 *                    apply as a filter (an interpretation note, not an error).
 *  - `limitation`  — understood and valid, but dropped by a current engine
 *                    limit (e.g. only one cross-reference per query).
 */
export type GapKind = 'unmapped' | 'recognized' | 'limitation'

/** A part of the user's query that did not become a filter. */
export interface OntologyGap {
  /** The unmapped user term. */
  term: string
  /** Why it could not be mapped. */
  reason: string
  /**
   * Category of the gap. Defaults to `unmapped` when absent (back-compat).
   * Drives how the UI groups and labels the gap.
   */
  kind?: GapKind
  /** Nearest concepts in the ontology that might be relevant. */
  suggestions?: string[]
  /** Domain glossary definition if available. */
  definition?: string
  /** Usage guidance (how to achieve what the user wants). */
  scopeNote?: string
  /** Whether this is a recognised domain concept (just not filterable). */
  isDomainConcept?: boolean
}

/** The LLM's structured interpretation of a user query. */
export interface QueryInterpretation {
  /** Human-readable summary of what was understood. */
  summary: string
  /** Individual term mappings with confidence. */
  mappedTerms: MappedTerm[]
  /** Domain(s) selected for this search (e.g., ["hdmap", "scenario"]). */
  domains?: string[]
  /**
   * Filters that actually made it into the compiled SPARQL. Includes
   * every leaf constraint — geography (country, state, city, …),
   * license, and any other SHACL-discovered leaf the user expressed.
   * Task 21d-flat unified these under a single map; the previous
   * `appliedLocation` field is gone.
   */
  appliedFilters?: Record<string, string | string[]>
}

/** A single sub-stage timing recorded by the request logger. */
export interface TimingEntry {
  stage: string
  durationMs: number
}

/**
 * Metadata emitted on the `meta` SSE event and embedded in
 * `/search/refine` responses. `requestId` is the value the API
 * middleware set in the `x-request-id` response header.
 */
export interface SearchMeta {
  requestId: string
  totalDatasets: number
  matchCount: number
  executionTimeMs: number
  /** Per-stage durations within the server pipeline. Optional on the wire. */
  timings?: TimingEntry[]
}

/** A single SPARQL result row, flattened to string values for the wire. */
export type ResultRow = Record<string, string>

/**
 * One step in a per-row traceability breadcrumb. The web client uses
 * these to render the asset → … → joined-asset path the SPARQL engine
 * walked, so users can see *why* a row matched (WP3, task #18).
 */
export interface ResultTraceStep {
  /** Full predicate IRI used to reach this step. */
  predicate: string
  /** Bound RDF term (IRI / blank-node) at this step. */
  intermediate: string
}

/**
 * One row's traceability, keyed by the projected referenced-asset variable
 * (`"refAsset"`, `"refAsset1"`, …). A multi-reference result carries one
 * breadcrumb per referenced asset so the UI can attach each chain to the
 * matching reference pill. References reached via the wildcard fallback (no
 * resolved predicate chain) have no entry.
 */
export type RowTraceability = Record<string, ResultTraceStep[]>

/**
 * Complete search response. Used by both `/search/refine` (synchronous
 * JSON) and assembled by the web client from the streamed `/search/stream`
 * SSE events.
 */
export interface SearchResponse {
  interpretation: QueryInterpretation
  gaps: OntologyGap[]
  sparql: string
  results: ResultRow[]
  /**
   * Optional per-row traceability, aligned by index with `results`. Present
   * only when the SPARQL contained a cross-reference JOIN; each entry maps a
   * referenced-asset variable to that reference's breadcrumb.
   */
  traceability?: RowTraceability[]
  meta: SearchMeta
}

/**
 * Body of the synchronous `/search/refine` JSON response. A refine runs only
 * the post-LLM half of the pipeline (compile pre-filled slots → execute), so —
 * unlike {@link SearchResponse} — it carries no `interpretation` or `gaps`.
 */
export interface RefineResponse {
  sparql: string
  results: ResultRow[]
  /** Per-row, per-reference breadcrumbs; present only when the query had a JOIN. */
  traceability?: RowTraceability[]
  meta: SearchMeta
}

/** Body of the `/stats` JSON response. */
export interface StatsResponse {
  totalAssets: number
  domains: Record<string, number>
  availableDomains: string[]
}

/**
 * One outgoing reference in a lineage tree. The predicate chain is the
 * full path the SPARQL engine traversed from the parent to `target` —
 * UI renders the leaf predicate's local name as the edge label and
 * keeps the full chain for hover/expand inspection.
 */
export interface TraceabilityEdge {
  predicatePath: string[]
  target: TraceabilityNode
}

/**
 * One node in a lineage tree (WP3, task #19). Returned by
 * `GET /traceability` per asset, recursively expanded up to the depth
 * budget. `truncated` is `true` when the walker stopped at this node
 * because depth was exhausted — UI may offer a "load more" affordance.
 */
export interface TraceabilityNode {
  asset: string
  name: string
  type: string
  domain: string
  references: TraceabilityEdge[]
  truncated: boolean
}

/** Body of the `/traceability` JSON response. */
export interface TraceabilityResponse {
  node: TraceabilityNode
}

/**
 * One property's value(s) inside a facet group on a specific asset.
 * `values` is a list because SHACL properties may carry multiple
 * bindings (e.g. multi-valued enumerations).
 */
export interface FacetValue {
  property: string
  values: string[]
}

/**
 * Per-asset facet snapshot returned by `GET /metadata/asset` (WP3
 * task #20). `groups` is keyed by the discovered SHACL shape-group
 * name (Content, Format, Quality, …). The endpoint treats all groups
 * uniformly — Quality is one facet, not a special case.
 */
export interface AssetMetadata {
  asset: string
  type: string
  domain: string
  groups: Record<string, FacetValue[]>
}

/** Distribution stats for one property across a domain. */
export interface PropertyStats {
  property: string
  totalValues: number
  distinctValues: number
  samples: string[]
  numericRange?: { min: number; max: number }
}

/** Body of the `/metadata/aggregate` JSON response. */
export interface DomainGroupAggregate {
  domain: string
  group: string
  assetCount: number
  properties: PropertyStats[]
}
