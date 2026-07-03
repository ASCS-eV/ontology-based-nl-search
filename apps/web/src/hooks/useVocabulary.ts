import { useQuery } from '@tanstack/react-query'

import { apiGet } from '../lib/api-client'
import type { EditorVocabulary } from '../lib/graphql-autocomplete'

/** Cap on the exponential retry backoff while the API warms up (ms). */
const MAX_RETRY_DELAY_MS = 10_000

/**
 * Fetch the ontology vocabulary that powers the GraphQL editor autocomplete.
 *
 * Retries through the API warmup window. The server binds its port only
 * AFTER a multi-second warmup, so the first request can lose the race and
 * fail with ECONNREFUSED. A one-shot fetch would then leave the vocabulary
 * null for the entire session and autocomplete would silently never work —
 * so this mirrors the resilient `/stats` query in SearchPage (retry +
 * exponential backoff). Cached for the session; the vocabulary is static.
 */
export function useVocabulary(): EditorVocabulary | null {
  const { data } = useQuery<EditorVocabulary>({
    queryKey: ['vocabulary'],
    queryFn: () => apiGet<EditorVocabulary>('/api/vocabulary'),
    retry: true,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS),
    staleTime: Infinity,
  })

  return data ?? null
}
