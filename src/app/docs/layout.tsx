'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/docs', label: 'Overview' },
  { href: '/docs/architecture', label: 'Architecture' },
  { href: '/docs/flow', label: 'Query Flow' },
  { href: '/docs/ontology', label: 'Ontology' },
  { href: '/docs/agent', label: 'Agent Design' },
  { href: '/docs/data', label: 'Data Model' },
  { href: '/docs/roadmap', label: 'Roadmap' },
]

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const currentIdx = NAV_ITEMS.findIndex((item) => item.href === pathname)
  const prev = currentIdx > 0 ? NAV_ITEMS[currentIdx - 1] : null
  const next =
    currentIdx < NAV_ITEMS.length - 1 ? NAV_ITEMS[currentIdx + 1] : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Documentation
            </h3>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  pathname === item.href
                    ? 'bg-blue/10 font-medium text-blue-900'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="min-w-0">
          <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-blue prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100">
            {children}
          </div>

          {/* Prev / Next navigation */}
          <nav className="mt-12 flex items-center justify-between border-t border-gray-200 pt-6">
            {prev ? (
              <Link
                href={prev.href}
                className="group flex items-center gap-2 text-sm text-gray-500 hover:text-blue"
              >
                <span className="transition-transform group-hover:-translate-x-1">
                  ←
                </span>
                {prev.label}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={next.href}
                className="group flex items-center gap-2 text-sm text-gray-500 hover:text-blue"
              >
                {next.label}
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
      </div>
    </div>
  )
}
