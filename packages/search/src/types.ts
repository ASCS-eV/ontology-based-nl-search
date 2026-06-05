/**
 * Re-exports the HTTP-boundary wire types from the browser-safe
 * `@ontology-search/api-types` package. Keeping the wire shapes there
 * lets the web client import the SAME declarations without pulling in
 * server-only modules (Oxigraph WASM, SHACL validator, Node `fs`).
 *
 * Server-internal additions (currently `LlmStructuredResponse`, which
 * carries `core/logging` `TimingEntry`s) live here on top of the
 * exported wire types.
 */
import type { TimingEntry } from '@ontology-search/core/logging'

import type { TraceabilityPlan } from './slots.js'

export type {
  GapKind,
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
  ResultRow,
  ResultTraceStep,
  RowTraceability,
  SearchMeta,
  SearchResponse,
  StatsResponse,
} from '@ontology-search/api-types'

import type { OntologyGap, QueryInterpretation } from '@ontology-search/api-types'

/**
 * Server-side full structured response from the LLM. Adds richer
 * `timings` than the wire form (the HTTP boundary trims down to
 * `TimingEntry` from `api-types`, which has the same shape).
 */
export interface LlmStructuredResponse {
  interpretation: QueryInterpretation
  gaps: OntologyGap[]
  sparql: string
  /**
   * Traceability plans emitted by the compiler when the SPARQL contains
   * cross-reference JOINs — one per projected reference. The service uses
   * them to attach per-row, per-reference breadcrumbs in
   * `ExecutionResult.traceability`.
   */
  trace?: TraceabilityPlan[]
  /** Per-stage timings within the LLM pipeline. */
  timings?: TimingEntry[]
}
