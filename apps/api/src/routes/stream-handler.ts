/**
 * SSE route helper — the streaming counterpart of `handleRoute`.
 *
 * `handleRoute` covered the JSON endpoints, where the boilerplate is a dozen
 * lines. The two SSE endpoints (`/search/stream`, `/author/stream`) carried
 * roughly sixty near-identical lines each — abort composition, body parsing,
 * query validation, per-request logging, abort-vs-failure discrimination and
 * the stream-level error hook — and were the place the duplication actually
 * hurt. They differ only in their log labels and in the extra fields each
 * accepts, so those are the parameters.
 *
 * STANDARDS — the response is a `text/event-stream` per
 *   [SSE] Server-Sent Events — docs/specs/references/eventsource.md §9.
 *
 * @see ./handler.ts — the JSON counterpart
 */
import { getConfig } from '@ontology-search/core/config'
import type { HttpError } from '@ontology-search/core/errors'
import { badRequest } from '@ontology-search/core/errors'
import { RequestLogger } from '@ontology-search/core/logging'
import { SSE_EVENT, type SseEventName } from '@ontology-search/core/sse/events'
import type { Context } from 'hono'
import type { SSEStreamingApi } from 'hono/streaming'
import { streamSSE } from 'hono/streaming'

import { sseErrorPayload } from '../middleware/error-handler.js'
import type { AppEnv } from '../types.js'

/** Everything a streaming handler needs; nothing it has to re-derive. */
export interface StreamContext<TBody> {
  /** The validated natural-language query. */
  query: string
  /** Whatever `parseBody` returned — the endpoint's own extra fields. */
  body: TBody
  /** Aborts when the client disconnects OR the SSE writer goes away. */
  signal: AbortSignal
  /** Request logger already carrying the requestId and the query. */
  logger: RequestLogger
  /** Write one named event; the payload is JSON-encoded for you. */
  emit: (event: SseEventName, data: unknown) => Promise<void>
}

export interface StreamRouteOptions<TBody> {
  /** Log-message prefix, e.g. "Stream search" → "Stream search completed". */
  label: string
  /** Client-facing message when the handler throws for a non-abort reason. */
  errorMessage: string
  /**
   * Validate the endpoint's own fields beyond `query`. Return an `HttpError`
   * to reject the request; the helper emits it as an `error` event and closes.
   * Omit when the endpoint takes nothing but `query`.
   */
  parseBody?: (raw: Record<string, unknown>) => TBody | HttpError
  handler: (ctx: StreamContext<TBody>) => Promise<void>
}

function isHttpError(value: unknown): value is HttpError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'body' in value &&
    typeof (value as HttpError).status === 'number'
  )
}

/**
 * Compose the two abort sources into one signal.
 *
 * A client can vanish in two distinguishable ways: the underlying HTTP request
 * aborts, or Hono notices the SSE writer is gone. Either must cancel the LLM
 * call and the store queries downstream, or we burn compute producing results
 * nobody is reading.
 */
function composeAbort(c: Context<AppEnv>, stream: SSEStreamingApi): AbortController {
  const controller = new AbortController()
  const requestSignal = c.req.raw.signal
  if (requestSignal.aborted) controller.abort()
  else requestSignal.addEventListener('abort', () => controller.abort(), { once: true })
  stream.onAbort(() => controller.abort())
  return controller
}

/**
 * Run an SSE endpoint with the shared request lifecycle.
 *
 * ```ts
 * route.post('/stream', (c) =>
 *   handleStreamRoute(c, {
 *     label: 'Stream search',
 *     errorMessage: 'Search failed',
 *     handler: async ({ query, signal, emit, logger }) => { ... },
 *   })
 * )
 * ```
 */
export function handleStreamRoute<TBody = undefined>(
  c: Context<AppEnv>,
  options: StreamRouteOptions<TBody>
): Response | Promise<Response> {
  const requestId = c.get('requestId')
  const streamLogger = new RequestLogger({ requestId })

  return streamSSE(
    c,
    async (stream) => {
      const controller = composeAbort(c, stream)
      const emit = async (event: SseEventName, data: unknown): Promise<void> => {
        await stream.writeSSE({ event, data: JSON.stringify(data) })
      }
      const reject = (error: HttpError): Promise<void> => emit(SSE_EVENT.ERROR, error.body)

      let raw: Record<string, unknown>
      try {
        raw = (await c.req.json()) as Record<string, unknown>
      } catch {
        await reject(badRequest('Invalid JSON body'))
        return
      }

      const query = raw?.['query']
      if (!query || typeof query !== 'string') {
        await reject(badRequest('Missing or invalid "query" field'))
        return
      }

      const maxQueryChars = getConfig().API_MAX_QUERY_CHARS
      if (query.length > maxQueryChars) {
        await reject(badRequest(`Query too long (${query.length} chars; max ${maxQueryChars}).`))
        return
      }

      let body = undefined as TBody
      if (options.parseBody) {
        const parsed = options.parseBody(raw)
        if (isHttpError(parsed)) {
          await reject(parsed)
          return
        }
        body = parsed
      }

      const logger = new RequestLogger({ requestId, query })
      logger.info(`${options.label} started`)

      try {
        await options.handler({ query, body, signal: controller.signal, logger, emit })
      } catch (error) {
        // A client-side abort is not a server error — log at info and exit
        // quietly rather than emitting a failure the client will never read.
        if (error instanceof DOMException && error.name === 'AbortError') {
          logger.info(`${options.label} aborted by client`)
          return
        }
        logger.error(`${options.label} failed`, error)
        await emit(SSE_EVENT.ERROR, sseErrorPayload(error, options.errorMessage))
      }
    },
    async (err, stream) => {
      streamLogger.error('SSE stream error', err)
      await stream.writeSSE({
        event: SSE_EVENT.ERROR,
        data: JSON.stringify(sseErrorPayload(err, 'Stream error')),
      })
    }
  )
}
