/**
 * Regression tests for the API status banner.
 *
 * The failure it exists to prevent: an API that started DEGRADED (no ontology
 * loaded, LLM provider unreachable) looked, from the browser, exactly like a
 * working app whose queries matched nothing. `/health` knew the reason the
 * whole time.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiStatusBanner } from '../ApiStatusBanner'

function renderBanner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<ApiStatusBanner />, { wrapper })
}

function mockHealth(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ApiStatusBanner', () => {
  it('renders nothing when the API is ready', async () => {
    mockHealth({ status: 'ok' })
    const { container } = renderBanner()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows every warmup error verbatim when the API is degraded', async () => {
    mockHealth(
      {
        status: 'degraded',
        errors: [
          'LLM session failed: Ollama is not reachable at http://localhost:11434/v1. Start it with `ollama serve`.',
        ],
      },
      503
    )
    renderBanner()

    expect(await screen.findByText(/started degraded/i)).toBeInTheDocument()
    // The remediation must survive to the screen — that is the whole point.
    expect(await screen.findByText(/ollama serve/)).toBeInTheDocument()
  })

  it('distinguishes "still warming up" from a real failure', async () => {
    mockHealth({ status: 'starting' }, 503)
    renderBanner()

    expect(await screen.findByText(/still warming up/i)).toBeInTheDocument()
    expect(screen.queryByText(/degraded/i)).not.toBeInTheDocument()
  })

  it('warns without crying "degraded" when only the LLM provider is unavailable', async () => {
    // The instance is serving: stats, vocabulary and slot-based refinement all
    // work. Reporting it as broken would be as misleading as saying nothing.
    mockHealth({
      status: 'ok',
      warnings: [
        'LLM provider access failed: Ollama is not reachable at http://localhost:11434/v1. Start it with `ollama serve`.',
      ],
    })
    renderBanner()

    expect(await screen.findByText(/Natural-language search is unavailable/i)).toBeInTheDocument()
    expect(await screen.findByText(/ollama serve/)).toBeInTheDocument()
    expect(screen.queryByText(/started degraded/i)).not.toBeInTheDocument()
  })

  it('tells the user how to start the API when nothing answers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    renderBanner()

    expect(await screen.findByText(/Cannot reach the API/i)).toBeInTheDocument()
    expect(await screen.findByText('pnpm dev')).toBeInTheDocument()
    expect(await screen.findByText('API_PORT')).toBeInTheDocument()
  })
})
