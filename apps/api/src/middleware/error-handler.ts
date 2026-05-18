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
