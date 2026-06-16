/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useVocabulary } from '../hooks/useVocabulary'

const VOCAB = {
  domains: ['hdmap'],
  properties: [
    {
      name: 'country',
      label: 'Country',
      description: '',
      domain: 'hdmap',
      type: 'enum' as const,
      allowedValues: ['Germany'],
    },
  ],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Fresh client per render so cached results don't leak between tests. */
function makeWrapper() {
  const client = new QueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useVocabulary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches the vocabulary and exposes it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(VOCAB))

    const { result } = renderHook(() => useVocabulary(), { wrapper: makeWrapper() })

    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toEqual(VOCAB))
    expect(fetchMock).toHaveBeenCalledWith('/api/vocabulary', {})
  })

  // Regression: the API binds its port only after warmup, so the first
  // request can fail with ECONNREFUSED. The previous one-shot fetch gave up
  // and left autocomplete permanently disabled. The hook must retry until the
  // API is ready.
  it('retries past an initial failure during API warmup and recovers', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(jsonResponse(VOCAB))

    const { result } = renderHook(() => useVocabulary(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current).toEqual(VOCAB), { timeout: 4000 })
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
