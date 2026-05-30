/**
 * Standardized API error handling utilities (framework-agnostic).
 *
 * Policy:
 * - Every error response uses a consistent JSON structure
 * - Proper HTTP status codes (never 200 for errors)
 * - Internal details are logged but not exposed to clients
 * - Non-critical endpoints may return degraded responses (partial data) with 200
 *
 * Library packages throw typed `AppError` subclasses (declared below). The
 * API's error handler maps them to HTTP status by `instanceof`, so renaming
 * an error message in a library cannot accidentally change the wire
 * contract. Plain `Error` instances escape to a generic 500.
 */

/**
 * Single source of truth for the `code` field on every API error
 * response. Producers and consumers must reference these symbols rather
 * than inline string literals so the wire contract cannot drift.
 */
export const ERROR_CODE = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE]

/** Standard error response payload sent to API clients */
export interface ApiErrorResponse {
  error: string
  code?: ErrorCode
  details?: string[]
}

/** HTTP status codes used by error responses */
export type HttpErrorStatus = 400 | 422 | 500 | 503

/** Structured error with HTTP status for use by any framework's response builder */
export interface HttpError {
  status: HttpErrorStatus
  body: ApiErrorResponse
}

// ─── Typed error hierarchy ───────────────────────────────────────────────────
//
// Library packages throw these instead of bare `Error`s. Each subclass owns a
// stable `code` (machine-readable) and `httpStatus` (consumed by the API
// error handler), so the wire contract is anchored to the class — not to the
// error message string. A library can reword a message freely without
// changing the HTTP status the caller sees.

/**
 * Abstract base for every library-thrown error that the HTTP layer maps to
 * a known status. Concrete subclasses override `code` and `httpStatus`
 * with stable identifiers. Callers in the API tier use `instanceof
 * AppError` (or a specific subclass) to drive status mapping.
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode
  abstract readonly httpStatus: HttpErrorStatus

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = this.constructor.name
  }
}

/**
 * Search compiler failed to produce a SPARQL query — e.g. the requested
 * domain doesn't exist in the registry, or the slot set is empty.
 * Surfaces as 422 because the slots parsed but are semantically invalid.
 */
export class CompileError extends AppError {
  readonly code = ERROR_CODE.UNPROCESSABLE_ENTITY
  readonly httpStatus = 422
}

/**
 * SPARQL store rejected a request or is otherwise unreachable. Includes
 * remote endpoint HTTP failures, load failures, and connection errors.
 * Always 503 — the API itself is up, but the backing store isn't.
 */
export class StoreUnavailableError extends AppError {
  readonly code = ERROR_CODE.SERVICE_UNAVAILABLE
  readonly httpStatus = 503
}

/**
 * LLM session unusable — missing credentials, expired token, unsupported
 * provider. Surfaces as 503 so clients can retry once the operator has
 * fixed the configuration; the API process itself is still running.
 */
export class AgentError extends AppError {
  readonly code = ERROR_CODE.SERVICE_UNAVAILABLE
  readonly httpStatus = 503
}

/**
 * `ontology-sources.json` manifest is present but unreadable or malformed.
 * The five duplicate source-discovery implementations previously consumed
 * these errors via silent `catch {}` blocks and fell back to the default
 * submodule path — making misconfigurations invisible. Surfacing as 503
 * because the API can't serve meaningful results without a valid manifest.
 */
export class OntologySourcesError extends AppError {
  readonly code = ERROR_CODE.SERVICE_UNAVAILABLE
  readonly httpStatus = 503
}

/**
 * A credentials file (e.g. `~/.claude/.credentials.json`) is readable by
 * group or other on the filesystem. Reading it would silently leak the
 * embedded OAuth token to any process running as a different user on the
 * machine, so we refuse and ask the operator to `chmod 600` it first.
 * Surfaced as 503 because the LLM session can't start without credentials.
 */
export class CredentialsPermissionError extends AppError {
  readonly code = ERROR_CODE.SERVICE_UNAVAILABLE
  readonly httpStatus = 503
}

/**
 * A SPARQL store's capabilities don't meet the runtime contract — e.g. it
 * doesn't support the property-path syntax (`*`, `+`) that the compiler
 * emits for `rdfs:subClassOf` / `skos:broaderTransitive` hierarchy walks.
 * Probed at startup so a mis-provisioned store is rejected loudly instead
 * of silently returning zero rows for every hierarchical filter.
 */
export class StoreCapabilityError extends AppError {
  readonly code = ERROR_CODE.SERVICE_UNAVAILABLE
  readonly httpStatus = 503
}

/** Create a 400 Bad Request error */
export function badRequest(message: string, details?: string[]): HttpError {
  return { status: 400, body: { error: message, code: ERROR_CODE.BAD_REQUEST, details } }
}

/** Create a 422 Unprocessable Entity error (valid syntax, semantic error) */
export function unprocessable(message: string, details?: string[]): HttpError {
  return { status: 422, body: { error: message, code: ERROR_CODE.UNPROCESSABLE_ENTITY, details } }
}

/** Create a 500 Internal Server Error (never expose internals) */
export function internalError(userMessage = 'An unexpected error occurred'): HttpError {
  return { status: 500, body: { error: userMessage, code: ERROR_CODE.INTERNAL_ERROR } }
}

/** Create a 503 Service Unavailable error (store not ready, LLM down) */
export function serviceUnavailable(message = 'Service temporarily unavailable'): HttpError {
  return { status: 503, body: { error: message, code: ERROR_CODE.SERVICE_UNAVAILABLE } }
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
