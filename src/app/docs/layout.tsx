import type { ReactNode } from 'react'

/**
 * Docs layout — minimal wrapper for the full-screen slide presentations.
 * Each doc page is its own self-contained slide deck.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="h-dvh w-full overflow-hidden bg-white">{children}</div>
}
