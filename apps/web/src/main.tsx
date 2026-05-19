import './styles.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

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

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
