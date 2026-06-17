/**
 * Server-Sent Events emitted by `/search/stream`.
 *
 * Single source of truth for the event names that the API route emits
 * and the web client parses. Producers and consumers both import from
 * this map so the wire contract cannot drift between sides.
 *
 * The names are wire-format constants, not ontology-specific terms.
 *
 * STANDARDS — the stream is a `text/event-stream` per
 *   [SSE] Server-Sent Events — docs/specs/references/eventsource.md
 *         https://www.w3.org/TR/eventsource/
 * Each frame uses the `event:` / `data:` field grammar of [SSE] §9 (the
 * `event stream` format); these constants are the `event:` field values.
 */

export const SSE_EVENT = {
  /** Progress signal: phase name + human-readable message. */
  STATUS: 'status',
  /** LLM interpretation: summary + mapped terms. */
  INTERPRETATION: 'interpretation',
  /** Ontology gaps: terms the LLM could not map. */
  GAPS: 'gaps',
  /** The compiled SPARQL query string (echoed for transparency). */
  SPARQL: 'sparql',
  /** The generated GraphQL query string (intermediate representation). */
  GRAPHQL: 'graphql',
  /** Result rows from the SPARQL store. */
  RESULTS: 'results',
  /** Final metadata: match count, request id, timings. */
  META: 'meta',
  /** Terminator: the stream is complete; no more events follow. */
  DONE: 'done',
  /** Error: a recoverable or fatal failure; the stream ends. */
  ERROR: 'error',
} as const

export type SseEventName = (typeof SSE_EVENT)[keyof typeof SSE_EVENT]
