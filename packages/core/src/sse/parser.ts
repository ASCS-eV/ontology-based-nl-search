/**
 * Generic Server-Sent Events (SSE) line parser.
 *
 * Processes a text stream buffer and emits structured events as
 * `{ event, data }` pairs. Follows the W3C EventSource specification
 * for line-based framing (event: / data: prefixes). Designed for
 * `ReadableStream` consumers in both the browser and Node.js — no
 * React/DOM imports.
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
 * SSE-over-network is an external boundary: a single bad JSON payload
 * must not kill the rest of the stream. Malformed `data:` lines are
 * skipped with a `console.warn` for operator diagnosis; well-formed
 * events before and after still surface to the consumer.
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

/**
 * Drain a `ReadableStream` of SSE bytes into a flat array of parsed
 * events. Useful in tests where the consumer wants the full event
 * sequence rather than streaming semantics.
 *
 * Reads until the stream is closed. Decoded as UTF-8.
 */
export async function collectSSEEvents<T = unknown>(
  body: ReadableStream<Uint8Array> | null
): Promise<ParsedSSEEvent<T>[]> {
  if (!body) return []

  const reader = body.getReader()
  const decoder = new TextDecoder()
  const collected: ParsedSSEEvent<T>[] = []
  let buffer = ''
  let pendingEvent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const result = parseSSEBuffer<T>(buffer, pendingEvent)
    buffer = result.remainder
    pendingEvent = result.pendingEvent
    collected.push(...result.events)
  }

  // Flush any trailing buffered content.
  buffer += decoder.decode()
  if (buffer.length > 0) {
    const final = parseSSEBuffer<T>(buffer + '\n', pendingEvent)
    collected.push(...final.events)
  }

  return collected
}
