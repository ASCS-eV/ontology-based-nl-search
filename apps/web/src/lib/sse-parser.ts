/**
 * Generic Server-Sent Events (SSE) line parser.
 *
 * Processes a text stream buffer and emits structured events as
 * `{ event, data }` pairs. Follows the W3C EventSource specification
 * for line-based framing (event: / data: prefixes).
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream
 */

/** A single parsed SSE event with its event type and deserialized data */
export interface ParsedSSEEvent<T = unknown> {
  event: string
  data: T
}

/** Result of processing a buffer chunk */
export interface SSEParseResult<T = unknown> {
  /** Successfully parsed events */
  events: ParsedSSEEvent<T>[]
  /** Remaining incomplete buffer (carry forward to next chunk) */
  remainder: string
  /** Pending event name awaiting its data line (carry forward to next chunk) */
  pendingEvent: string
}

/**
 * Parse an SSE text buffer into structured events.
 *
 * Handles the standard SSE wire format:
 * ```
 * event: eventName
 * data: {"json":"payload"}
 *
 * ```
 *
 * @param buffer - Accumulated text from the stream (may contain partial lines)
 * @param pendingEvent - Event name carried from a previous chunk (optional)
 * @returns Parsed events, remaining incomplete text, and any pending event name
 */
export function parseSSEBuffer<T = unknown>(buffer: string, pendingEvent = ''): SSEParseResult<T> {
  const events: ParsedSSEEvent<T>[] = []
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''

  let currentEvent = pendingEvent
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7)
    } else if (line.startsWith('data: ') && currentEvent) {
      // SSE-over-network is an external boundary: a single malformed JSON
      // payload must not kill the rest of the stream. Skip the bad line,
      // log it for diagnosis, and keep parsing — every well-formed event
      // before and after still surfaces to the consumer.
      const payload = line.slice(6)
      try {
        const data = JSON.parse(payload) as T
        events.push({ event: currentEvent, data })
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.warn(`SSE: dropping malformed data line for event "${currentEvent}": ${reason}`)
      }
      currentEvent = ''
    }
  }

  return { events, remainder, pendingEvent: currentEvent }
}
