/**
 * Standardized API error handling utilities (framework-agnostic).
 *
 * Policy:
 * - Every error response uses a consistent JSON structure
 * - Proper HTTP status codes (never 200 for errors)
 * - Internal details are logged but not exposed to clients
 * - Non-critical endpoints may return degraded responses (partial data) with 200
 */

/** Standard error response payload sent to API clients */
export interface ApiErrorResponse {
  error: string
  code?: string
  details?: string[]
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

/** HTTP status codes used by error responses */
export type HttpErrorStatus = 400 | 422 | 500 | 503

/** Structured error with HTTP status for use by any framework's response builder */
export interface HttpError {
  status: HttpErrorStatus
  body: ApiErrorResponse
}

/** Create a 400 Bad Request error */
export function badRequest(message: string, details?: string[]): HttpError {
  return { status: 400, body: { error: message, code: 'BAD_REQUEST', details } }
}

/** Create a 422 Unprocessable Entity error (valid syntax, semantic error) */
export function unprocessable(message: string, details?: string[]): HttpError {
  return { status: 422, body: { error: message, code: 'UNPROCESSABLE_ENTITY', details } }
}

/** Create a 500 Internal Server Error (never expose internals) */
export function internalError(userMessage = 'An unexpected error occurred'): HttpError {
  return { status: 500, body: { error: userMessage, code: 'INTERNAL_ERROR' } }
}

/** Create a 503 Service Unavailable error (store not ready, LLM down) */
export function serviceUnavailable(message = 'Service temporarily unavailable'): HttpError {
  return { status: 503, body: { error: message, code: 'SERVICE_UNAVAILABLE' } }
}

/**
 * Safely extract an error message from an unknown thrown value.
 * For logging only — never send raw error messages to clients.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}
