/**
 * Route handler helper — wraps the repeated validate → log → execute → respond
 * pattern shared by all JSON-returning API endpoints.
 *
 * Reduces per-handler boilerplate (requestId extraction, logger creation,
 * error mapping, response headers) from ~15 lines to a single call.
 */
import type { HttpError } from '@ontology-search/core/errors'
import { internalError } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import type { Context } from 'hono'

import type { AppEnv } from '../types.js'

/** Options for the route handler wrapper. */
interface RouteHandlerOptions<T> {
  /** Human-readable label for log messages (e.g. "Stats", "Metadata asset"). */
  label: string
  /**
   * The handler body. Receives the Hono context and a pre-configured logger.
   * Return the response payload on success, or an HttpError to short-circuit.
   */
  handler: (c: Context<AppEnv>, logger: RequestLogger) => Promise<T | HttpError>
  /** Fallback error message if the handler throws unexpectedly. */
  errorMessage?: string
}

/**
 * Returns true when the value is an HttpError (has status + body).
 */
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
 * Execute a route handler with standardized logging, error mapping, and
 * response headers. Usage:
 *
 * ```ts
 * route.get('/', (c) => handleRoute(c, {
 *   label: 'Stats',
 *   handler: async (_c, logger) => { ... return payload },
 * }))
 * ```
 */
export async function handleRoute<T>(
  c: Context<AppEnv>,
  options: RouteHandlerOptions<T>
): Promise<Response> {
  const requestId = c.get('requestId') as string
  const logger = new RequestLogger({ requestId })

  try {
    const result = await options.handler(c, logger)

    if (isHttpError(result)) {
      return c.json(result.body, result.status)
    }

    return c.json(result as object, 200, { [REQUEST_ID_HEADER]: requestId })
  } catch (error) {
    logger.error(`${options.label} API error`, error)
    const err = internalError(options.errorMessage ?? `Failed to process ${options.label} request`)
    return c.json(err.body, err.status)
  }
}
