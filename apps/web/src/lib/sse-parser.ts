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
 * @returns Parsed events and any remaining incomplete text
 */
export function parseSSEBuffer<T = unknown>(buffer: string): SSEParseResult<T> {
  const events: ParsedSSEEvent<T>[] = []
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''

  let currentEvent = ''
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7)
    } else if (line.startsWith('data: ') && currentEvent) {
      const data = JSON.parse(line.slice(6)) as T
      events.push({ event: currentEvent, data })
      currentEvent = ''
    }
  }

  return { events, remainder }
}
