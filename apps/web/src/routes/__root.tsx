import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

import { ApiStatusBanner } from '../components/ApiStatusBanner'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header />
      <ApiStatusBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
