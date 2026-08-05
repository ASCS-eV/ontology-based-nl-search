import { useQuery } from '@tanstack/react-query'

/**
 * Readiness of the API behind this UI.
 *
 * `/health` already reports warmup failures in detail — no ontology loaded, an
 * unreachable LLM provider, a store that cannot serve property paths — but the
 * UI never asked. A degraded API therefore looked like a working app that
 * returned nothing for every query, which is the single hardest first-run
 * symptom to diagnose from the browser.
 */
export type ApiHealthState =
  | { status: 'ok' }
  | { status: 'starting' }
  | { status: 'degraded'; errors: string[] }
  | { status: 'unreachable' }

/** Poll interval while the API is not ready, so the banner clears by itself. */
const RECHECK_MS = 5_000

interface HealthBody {
  status?: string
  errors?: unknown
}

/**
 * Read `/health` without throwing on 503 — that status IS the answer here,
 * and its body carries the warmup errors the operator needs to see.
 */
export async function fetchApiHealth(fetchImpl: typeof fetch = fetch): Promise<ApiHealthState> {
  let response: Response
  try {
    response = await fetchImpl('/api/health')
  } catch {
    // Nothing is listening, or the dev proxy has no target — either way the
    // browser cannot tell us more than "no answer".
    return { status: 'unreachable' }
  }

  const body = (await response.json().catch(() => null)) as HealthBody | null
  if (response.ok && body?.status === 'ok') return { status: 'ok' }
  if (body?.status === 'starting') return { status: 'starting' }

  const errors = Array.isArray(body?.errors)
    ? body.errors.filter((entry): entry is string => typeof entry === 'string')
    : []
  if (body?.status === 'degraded') return { status: 'degraded', errors }
  // A response we cannot interpret still means the API is not serving normally.
  return { status: 'unreachable' }
}

export function useApiHealth(): ApiHealthState | null {
  const { data } = useQuery<ApiHealthState>({
    queryKey: ['api-health'],
    queryFn: () => fetchApiHealth(),
    // The state is the value even when it is bad, so never treat it as a
    // failed query — retrying would hide the banner behind a loading state.
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'ok' ? false : RECHECK_MS),
    refetchOnWindowFocus: true,
  })

  return data ?? null
}
