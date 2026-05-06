'use client'

import { useState } from 'react'
import { SearchBar } from '@/components/SearchBar'
import { ResultsDisplay } from '@/components/ResultsDisplay'
import { SparqlPreview } from '@/components/SparqlPreview'

export default function Home() {
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [sparql, setSparql] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (naturalLanguageQuery: string) => {
    setLoading(true)
    setError(null)
    setResults(null)
    setSparql(null)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: naturalLanguageQuery }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Search failed')
      }

      const data = await response.json()
      setSparql(data.sparql)
      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-24">
      <h1 className="text-3xl font-bold mb-2 text-center">
        ENVITED-X Simulation Asset Search
      </h1>
      <p className="text-gray-500 mb-8 text-center max-w-lg">
        Search simulation assets using natural language. Your query is translated into SPARQL using ontology-guided AI.
      </p>

      <SearchBar onSearch={handleSearch} loading={loading} />

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl w-full">
          {error}
        </div>
      )}

      {sparql && <SparqlPreview sparql={sparql} />}
      {results && <ResultsDisplay results={results} />}
    </main>
  )
}
