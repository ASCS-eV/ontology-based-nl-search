'use client'

import { useEffect, useState } from 'react'

interface DomainSelectorProps {
  selectedDomains: string[]
  onChange: (domains: string[]) => void
}

/**
 * Domain selector component — displays available ontology domains
 * and lets users pick which one(s) to search.
 */
export function DomainSelector({ selectedDomains, onChange }: DomainSelectorProps) {
  const [availableDomains, setAvailableDomains] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/domains')
      .then((res) => res.json())
      .then((data) => {
        setAvailableDomains(data.domains || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="animate-pulse">Loading domains…</span>
      </div>
    )
  }

  if (availableDomains.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-600">Domain:</span>
      {availableDomains.map((domain) => {
        const isSelected = selectedDomains.includes(domain)
        return (
          <button
            key={domain}
            onClick={() => {
              if (isSelected) {
                const next = selectedDomains.filter((d) => d !== domain)
                onChange(next.length > 0 ? next : [domain])
              } else {
                onChange([...selectedDomains, domain])
              }
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={`Search ${domain} assets`}
          >
            {formatDomainName(domain)}
          </button>
        )
      })}
    </div>
  )
}

/** Convert domain slug to display name (e.g., "hdmap" → "HD Map") */
function formatDomainName(domain: string): string {
  const specialCases: Record<string, string> = {
    hdmap: 'HD Map',
    ositrace: 'OSI Trace',
    'vv-report': 'V&V Report',
    tzip21: 'TZIP-21',
  }
  const special = specialCases[domain]
  if (special) return special
  return domain
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
