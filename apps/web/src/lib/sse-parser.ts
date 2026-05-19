/**
 * Re-export of the SSE line parser from `@ontology-search/core/sse/parser`.
 *
 * The parser is a wire-format primitive (no DOM/React dependencies) and
 * is consumed by both the web client and API SSE-contract tests. Lives
 * in core so neither side has to dig into the other's app layout to
 * find it.
 */
export {
  collectSSEEvents,
  type ParsedSSEEvent,
  parseSSEBuffer,
  type SSEParseResult,
} from '@ontology-search/core/sse/parser'
