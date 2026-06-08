/**
 * Shared API client — centralizes fetch calls, error parsing, and abort handling.
 *
 * Every endpoint request flows through this module so retry semantics,
 * error extraction, and abort-signal propagation stay consistent across
 * all frontend surfaces.
 */

/** Structured error from the API (matches ApiErrorResponse on the server). */
export interface ApiError {
  error: string
  code?: string
  details?: string[]
}

/**
 * Fetch a JSON endpoint and parse the response. Throws an `Error` with
 * the server-provided message on non-2xx responses.
 */
export async function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : {})
  if (!res.ok) {
    const body = await parseErrorBody(res)
    throw new Error(body?.error ?? `Request failed: HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

/**
 * POST JSON to an endpoint and parse the response. Throws an `Error` with
 * the server-provided message on non-2xx responses.
 */
export async function apiPost<T>(
  url: string,
  body: unknown,
  options?: { signal?: AbortSignal }
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  })
  if (!res.ok) {
    const errBody = await parseErrorBody(res)
    throw new Error(errBody?.error ?? `Request failed: HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

/**
 * POST to a streaming endpoint and return the raw Response for SSE parsing.
 * Throws on non-2xx.
 */
export async function apiPostStream(
  url: string,
  body: unknown,
  options?: { signal?: AbortSignal }
): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  })
  if (!res.ok) {
    const errBody = await parseErrorBody(res)
    throw new Error(errBody?.error ?? `Request failed: HTTP ${res.status}`)
  }
  return res
}

/** Returns true if the error is an abort (user navigated away, component unmounted). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Best-effort parse of an error response body. Returns null on parse failure. */
async function parseErrorBody(res: Response): Promise<ApiError | null> {
  try {
    return (await res.json()) as ApiError
  } catch {
    return null
  }
}
