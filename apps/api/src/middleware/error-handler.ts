import type { ErrorCode } from '@ontology-search/core/errors'
import { AppError, ERROR_CODE, extractErrorMessage } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'
import type { Context } from 'hono'

import type { AppEnv } from '../types.js'

const logger = createComponentLogger('error-handler')

/**
 * Hono `onError` handler.
 *
 * Typed `AppError`s thrown by library packages carry their own HTTP status
 * and machine-readable code; we surface those without ever inspecting the
 * error message. Plain `Error` instances fall through to a generic 500 —
 * the message is logged for operators but never echoed to the client.
 */
/**
 * The payload an SSE route sends on its `error` event.
 *
 * Same policy as {@link errorHandler}, expressed for a transport that has
 * already sent HTTP 200 and so cannot carry a status: a typed `AppError` is a
 * condition the operator is meant to act on — missing credentials, an expired
 * token, no ontology loaded — and its message is written for exactly that, so
 * it is forwarded verbatim along with its machine-readable code. Anything else
 * is an internal fault: the caller gets `fallback` and the details stay in the
 * log.
 *
 * Before this, every streaming failure collapsed to one generic string, which
 * meant the actionable half of this repo's error messages — the ones naming
 * the file to chmod, the command to re-authenticate, the ontology to fetch —
 * could only be found by reading the server's terminal.
 */
export function sseErrorPayload(
  error: unknown,
  fallback: string
): { message: string; code?: ErrorCode } {
  if (error instanceof AppError) return { message: error.message, code: error.code }
  return { message: fallback }
}

export function errorHandler(err: Error, c: Context<AppEnv>) {
  const requestId = c.get('requestId') ?? 'unknown'

  if (err instanceof AppError) {
    logger.error(`Typed error [${requestId}]`, {
      name: err.name,
      code: err.code,
      httpStatus: err.httpStatus,
      message: err.message,
    })
    return c.json({ error: err.message, code: err.code }, err.httpStatus)
  }

  const message = extractErrorMessage(err)
  logger.error(`Unhandled error [${requestId}]`, { message })

  return c.json({ error: 'Internal server error', code: ERROR_CODE.INTERNAL_ERROR }, 500)
}
