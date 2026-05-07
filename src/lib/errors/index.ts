/**
 * Standardized API error handling utilities.
 *
 * Policy:
 * - Every error response uses a consistent JSON structure
 * - Proper HTTP status codes (never 200 for errors)
 * - Internal details are logged but not exposed to clients
 * - Non-critical endpoints may return degraded responses (partial data) with 200
 */
import { NextResponse } from 'next/server'

/** Standard error response payload sent to API clients */
export interface ApiErrorResponse {
  error: string
  code?: string
  details?: string[]
}

/** Create a 400 Bad Request response */
export function badRequest(message: string, details?: string[]): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: message, code: 'BAD_REQUEST', details }, { status: 400 })
}

/** Create a 422 Unprocessable Entity response (valid syntax, semantic error) */
export function unprocessable(message: string, details?: string[]): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: message, code: 'UNPROCESSABLE_ENTITY', details },
    { status: 422 }
  )
}

/** Create a 500 Internal Server Error response (never expose internals) */
export function internalError(
  userMessage = 'An unexpected error occurred'
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: userMessage, code: 'INTERNAL_ERROR' }, { status: 500 })
}

/** Create a 503 Service Unavailable response (store not ready, LLM down) */
export function serviceUnavailable(
  message = 'Service temporarily unavailable'
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: message, code: 'SERVICE_UNAVAILABLE' }, { status: 503 })
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
