import './styles.css'
import '@ontology-search/design-system/tokens.css'

import { DesignSystemProvider } from '@ontology-search/design-system'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ErrorBoundary } from './components/ErrorBoundary'
import { activeDesignSystem } from './design-system'
import { routeTree } from './routeTree.gen'

/** How long fetched data remains fresh before background refetch (ms) */
const QUERY_STALE_TIME_MS = 30_000

/** Number of automatic retries on failed queries */
const QUERY_RETRY_COUNT = 1

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS, retry: QUERY_RETRY_COUNT } },
})

const router = createRouter({ routeTree, context: { queryClient } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!

// Apply the active design system's branding before first paint.
document.documentElement.dataset.theme = activeDesignSystem.brand.theme
document.title = activeDesignSystem.brand.appTitle

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <DesignSystemProvider system={activeDesignSystem}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </DesignSystemProvider>
    </ErrorBoundary>
  </StrictMode>
)
