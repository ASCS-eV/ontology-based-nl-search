/**
 * Server-internal types built ON TOP of the HTTP-boundary wire types.
 *
 * The wire shapes themselves live in the browser-safe
 * `@ontology-search/api-types` package and are imported from there directly —
 * by this module, by the web client, and by every other consumer. This module
 * deliberately does not re-export them: doing so let callers reach api-types
 * through `search` without declaring it, which hid the real edge from
 * `scripts/check-layers.mjs`.
 */
import type { OntologyGap, QueryInterpretation } from '@ontology-search/api-types'
import type { TimingEntry } from '@ontology-search/core/logging'
import type { SearchSlots, TraceabilityPlan } from '@ontology-search/slots/slots'

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
   * The validated SearchSlots that produced this SPARQL. Available for
   * downstream serialization (e.g. GraphQL intermediate representation).
   */
  slots?: SearchSlots
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
