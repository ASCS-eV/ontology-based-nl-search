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

/** A concept the user mentioned that isn't in the ontology. */
export interface OntologyGap {
  /** The unmapped user term. */
  term: string
  /** Why it could not be mapped. */
  reason: string
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
  /** Filters that actually made it into the compiled SPARQL. */
  appliedFilters?: Record<string, string | string[]>
  /** Location filters that made it into the compiled SPARQL. */
  appliedLocation?: Record<string, string | string[]>
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
 * Complete search response. Used by both `/search/refine` (synchronous
 * JSON) and assembled by the web client from the streamed `/search/stream`
 * SSE events.
 */
export interface SearchResponse {
  interpretation: QueryInterpretation
  gaps: OntologyGap[]
  sparql: string
  results: ResultRow[]
  meta: SearchMeta
}

/** Body of the `/stats` JSON response. */
export interface StatsResponse {
  totalAssets: number
  domains: Record<string, number>
  availableDomains: string[]
}
