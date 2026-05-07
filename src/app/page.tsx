'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { InterpretationDisplay } from '@/components/InterpretationDisplay'
import { OntologyGapsDisplay } from '@/components/OntologyGapsDisplay'
import { QueryRefinement } from '@/components/QueryRefinement'
import { ResultsDisplay } from '@/components/ResultsDisplay'
import { SearchBar } from '@/components/SearchBar'
import { SparqlPreview } from '@/components/SparqlPreview'
import type { MappedTerm, OntologyGap, QueryInterpretation, SearchResponse } from '@/lib/llm/types'

const HISTORY_KEY = 'nl-search-history'
const MAX_HISTORY = 10

/** Map ontology property names to their filter group for SearchSlots */
function isLocationProperty(property: string): boolean {
  return ['country', 'state', 'region', 'city'].includes(property)
}

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

type SearchPhase = 'idle' | 'interpreting' | 'executing' | 'done'

export default function Home() {
  const [interpretation, setInterpretation] = useState<QueryInterpretation | null>(null)
  const [gaps, setGaps] = useState<OntologyGap[] | null>(null)
  const [sparql, setSparql] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string>[] | null>(null)
  const [meta, setMeta] = useState<SearchResponse['meta'] | null>(null)
  const [phase, setPhase] = useState<SearchPhase>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalAssets, setTotalAssets] = useState<number | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setHistory(getSearchHistory())

    async function loadStats() {
      try {
        const response = await fetch('/api/stats')
        const data = await response.json()
        setTotalAssets(data.totalAssets)
      } catch {
        // Stats are non-critical — silently ignore failures
      }
    }

    loadStats()
  }, [])

  const handleSearch = useCallback(async (naturalLanguageQuery: string) => {
    // Abort any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    setInterpretation(null)
    setGaps(null)
    setSparql(null)
    setResults(null)
    setMeta(null)
    setPhase('interpreting')

    try {
      const res = await fetch('/api/search/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: naturalLanguageQuery }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ') && currentEvent) {
            const data = JSON.parse(line.slice(6))
            switch (currentEvent) {
              case 'status':
                setPhase(data.phase as SearchPhase)
                break
              case 'interpretation':
                setInterpretation(data)
                break
              case 'gaps':
                setGaps(data)
                break
              case 'sparql':
                setSparql(data)
                break
              case 'results':
                setResults(data.results)
                if (data.error) setError(data.error)
                break
              case 'meta':
                setMeta(data)
                if (data.totalDatasets) setTotalAssets(data.totalDatasets)
                break
              case 'done':
                setPhase('done')
                break
              case 'error':
                setError(data.message)
                break
            }
            currentEvent = ''
          }
        }
      }

      saveToHistory(naturalLanguageQuery)
      setHistory(getSearchHistory())
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User started a new search — silently ignore
        return
      }
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
      setPhase('done')
    }
  }, [])

  const handleRefine = useCallback(async (updatedTerms: MappedTerm[]) => {
    setLoading(true)
    setError(null)
    setResults(null)
    setMeta(null)
    setPhase('executing')

    try {
      // Convert mapped terms to generic SearchSlots format
      const filters: Record<string, string> = {}
      const location: Record<string, string> = {}

      for (const term of updatedTerms) {
        if (term.property && term.mapped) {
          if (isLocationProperty(term.property)) {
            location[term.property] = term.mapped
          } else {
            filters[term.property] = term.mapped
          }
        }
      }

      const slots = {
        domains: ['hdmap'],
        filters,
        ranges: {},
        ...(Object.keys(location).length > 0 ? { location } : {}),
      }

      const res = await fetch('/api/search/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Refine failed')
      }

      const data = await res.json()
      setSparql(data.sparql)
      setResults(data.results)
      setMeta(data.meta)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refine failed')
    } finally {
      setLoading(false)
      setPhase('done')
    }
  }, [])

  const hasResponse = interpretation || gaps || sparql || results

  return (
    <div className="flex flex-col items-center px-4 pt-12 pb-16">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Simulation Asset Search</h1>
        <p className="text-gray-500 max-w-lg mx-auto text-sm leading-relaxed">
          Describe what you&apos;re looking for in plain language. The AI will interpret your query
          against the ontology and find matching assets.
        </p>
        {totalAssets !== null && totalAssets > 0 && (
          <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 bg-blue-50 text-blue-900 text-sm font-medium rounded-full border border-blue-100">
            <span className="w-2 h-2 bg-blue rounded-full animate-pulse" />
            {totalAssets} assets in graph
          </span>
        )}
      </div>

      {/* Search */}
      <SearchBar onSearch={handleSearch} loading={loading} history={history} />

      {/* Error */}
      {error && !results && (
        <div
          className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl w-full"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Progressive results */}
      {hasResponse && (
        <div className="mt-8 w-full max-w-4xl mx-auto space-y-4">
          {interpretation && <InterpretationDisplay interpretation={interpretation} />}

          {interpretation && interpretation.mappedTerms.length > 0 && (
            <QueryRefinement
              mappedTerms={interpretation.mappedTerms}
              onRerun={handleRefine}
              loading={loading}
            />
          )}

          {gaps && <OntologyGapsDisplay gaps={gaps} />}

          {sparql && <SparqlPreview sparql={sparql} />}

          {/* Loading indicator between interpretation and results */}
          {phase === 'executing' && !results && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
              <span className="w-4 h-4 border-2 border-blue border-t-transparent rounded-full animate-spin" />
              Executing SPARQL query…
            </div>
          )}

          {results && <ResultsDisplay results={results} />}

          {/* Execution metadata */}
          {meta && (
            <div className="pt-2 text-xs text-gray-400 flex items-center gap-3 justify-center">
              <span>{meta.matchCount} results</span>
              <span className="text-gray-300">·</span>
              <span>{meta.executionTimeMs}ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
