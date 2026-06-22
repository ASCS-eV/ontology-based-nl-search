/**
 * SearchService contract types (ADR 0003) — the injected-dependency, result,
 * and options interfaces for the orchestration class in `./service.js`. Split
 * out so `service.ts` (the class) stays under CONTRIBUTING #15. Pure types.
 */
import type { TimingEntry } from '@ontology-search/core/logging'
import type { PolicyResult } from '@ontology-search/sparql/policy'
import type { SparqlStore } from '@ontology-search/sparql/types'

import type { CompileResult, SearchSlots } from './slots.js'
import type {
  LlmStructuredResponse,
  ResultRow,
  ResultTraceStep,
  RowTraceability,
  SearchMeta as WireSearchMeta,
} from './types.js'

// Re-export the wire row/step types so any intra-package reference keeps
// resolving from here, while the single declaration lives in api-types.
export type { ResultRow, ResultTraceStep }

// ─── Dependency Interfaces ───────────────────────────────────────────────────

/** External dependencies required by SearchService */
export interface SearchDependencies {
  /** Resolve the initialized SPARQL store (handles lazy init + data loading) */
  getStore: () => Promise<SparqlStore>
  /** Translate natural language → structured interpretation + SPARQL */
  interpretQuery: (
    query: string,
    options: { domain?: string; signal?: AbortSignal }
  ) => Promise<LlmStructuredResponse>
  /**
   * Compile search slots into a SPARQL query and (when the query
   * contains a cross-reference JOIN) a traceability plan the service
   * uses to attach a per-row breadcrumb. Production wires this to
   * `compileSlotsWithTrace`; tests typically supply a stub returning
   * just `{ sparql }`.
   */
  compileSlots: (slots: SearchSlots) => Promise<CompileResult>
  /** Compile count queries for all registered asset domains */
  compileCountQueries: () => Promise<{ domain: string; query: string }[]>
  /** Validate a SPARQL query against security policy */
  enforcePolicy: (sparql: string) => PolicyResult & { query: string }
  /**
   * Apply ontology-level SHACL validation to refine-path slots, dropping
   * any value that violates a declared constraint. The LLM agent path runs
   * SHACL validation itself; this dependency closes the same gap for any
   * caller that supplies pre-filled slots directly. Optional — when omitted,
   * slots flow through unchanged (matches the pre-Phase-1 behaviour).
   */
  validateSlots?: (slots: SearchSlots) => Promise<SearchSlots>
}

// ─── Result Types ────────────────────────────────────────────────────────────

/** Result of executing a compiled SPARQL query */
export interface ExecutionResult {
  results: ResultRow[]
  /**
   * Per-row traceability, aligned by index with `results`. Present iff the
   * compiled query carried reference `TraceabilityPlan`s. Each entry maps a
   * referenced-asset variable (`refAsset`, `refAsset1`, …) to the steps the
   * JOIN walked from `?asset` to that reference — UI clients render each as a
   * breadcrumb under the matching reference pill.
   */
  traceability?: RowTraceability[]
  sparql: string
  error?: string
}

/** Full search result including LLM interpretation */
export interface SearchResult {
  interpretation: LlmStructuredResponse['interpretation']
  gaps: LlmStructuredResponse['gaps']
  sparql: string
  execution: ExecutionResult
  meta: SearchMeta
}

/** Refine-only search result (no LLM phase) */
export interface RefineResult {
  sparql: string
  execution: ExecutionResult
  meta: SearchMeta
}

/**
 * Metadata about a search execution. Single-sourced from the wire
 * {@link WireSearchMeta} (api-types) so the server and web client cannot drift;
 * tightened only in that the server ALWAYS populates `timings` (optional on the
 * wire). Assignable to the wire type, so route responses can `satisfies` it.
 */
export interface SearchMeta extends WireSearchMeta {
  timings: TimingEntry[]
}

/** Progress event emitted during incremental search phases. */
export interface SearchProgress {
  phase: 'store-ready' | 'interpreting' | 'interpreted' | 'executing' | 'done'
  /** Partial result data available at this phase. */
  data?: Partial<Pick<SearchResult, 'interpretation' | 'gaps' | 'sparql'>> & {
    /** Raw validated slots (for GraphQL serialization). */
    slots?: SearchSlots
  }
}

/** Options for a full NL search */
export interface NlSearchOptions {
  query: string
  domain?: string
  signal?: AbortSignal
  /**
   * Correlation id from the upstream HTTP middleware. When supplied, the
   * service adopts it so the requestId in response headers, SSE meta
   * events, and server-side logs all match. When omitted (CLI / library
   * use), a fresh id is generated.
   */
  requestId?: string
  /**
   * Optional progress callback invoked at each pipeline phase boundary.
   * Enables incremental SSE streaming — the route can emit events as soon
   * as each phase completes rather than waiting for the full pipeline.
   */
  onProgress?: (progress: SearchProgress) => Promise<void> | void
}

/** Options for a refine (slot-based) search */
export interface RefineOptions {
  slots: SearchSlots
  signal?: AbortSignal
  /** See {@link NlSearchOptions.requestId}. */
  requestId?: string
}
