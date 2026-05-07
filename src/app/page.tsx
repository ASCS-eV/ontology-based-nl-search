'use client'

import { useState, useEffect, useCallback } from 'react'
import { SearchBar } from '@/components/SearchBar'
import { InterpretationDisplay } from '@/components/InterpretationDisplay'
import { OntologyGapsDisplay } from '@/components/OntologyGapsDisplay'
import { SparqlPreview } from '@/components/SparqlPreview'
import { ResultsDisplay } from '@/components/ResultsDisplay'
import type { SearchResponse } from '@/lib/llm/types'

const HISTORY_KEY = 'nl-search-history'
const MAX_HISTORY = 10

function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function saveToHistory(query: string) {
  const history = getSearchHistory().filter((h) => h !== query)
  history.unshift(query)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

export default function Home() {
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalAssets, setTotalAssets] = useState<number | null>(null)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    setHistory(getSearchHistory())
    // Fetch dataset count on mount
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => setTotalAssets(data.totalAssets))
      .catch(() => {})
  }, [])

  const handleSearch = useCallback(async (naturalLanguageQuery: string) => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: naturalLanguageQuery }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data: SearchResponse = await res.json()
      setResponse(data)
      saveToHistory(naturalLanguageQuery)
      setHistory(getSearchHistory())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col items-center px-4 pt-12 pb-16">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Simulation Asset Search</h1>
        <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
          Describe what you&apos;re looking for in plain language. The AI will interpret your query
          against the HD map ontology and find matching assets.
        </p>
        {totalAssets !== null && totalAssets > 0 && (
          <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 bg-blue-50 text-blue-900 text-sm font-medium rounded-full border border-blue-100">
            <span className="w-2 h-2 bg-blue rounded-full animate-pulse" />
            {totalAssets} HD map assets in graph
          </span>
        )}
      </div>

      {/* Search */}
      <SearchBar onSearch={handleSearch} loading={loading} history={history} />

      {/* Error */}
      {error && (
        <div
          className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl w-full"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Progressive results */}
      {response && (
        <div className="mt-8 w-full max-w-4xl mx-auto space-y-4">
          <InterpretationDisplay interpretation={response.interpretation} />
          <OntologyGapsDisplay gaps={response.gaps} />
          <SparqlPreview sparql={response.sparql} />
          <ResultsDisplay results={response.results} />

          {/* Execution metadata */}
          <div className="pt-2 text-xs text-gray-400 flex items-center gap-3">
            <span>{response.meta.matchCount} results</span>
            <span className="text-gray-300">·</span>
            <span>{response.meta.executionTimeMs}ms</span>
          </div>
        </div>
      )}
    </div>
  )
}
