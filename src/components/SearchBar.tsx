'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading?: boolean
  history?: string[]
}

export function SearchBar({ onSearch, loading, history = [] }: SearchBarProps) {
  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !loading) {
      onSearch(input.trim())
      setShowHistory(false)
    }
  }

  const selectHistory = (query: string) => {
    setInput(query)
    setShowHistory(false)
    onSearch(query)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl" role="search">
      <div className="relative" ref={wrapperRef}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => history.length > 0 && !input && setShowHistory(true)}
          placeholder="e.g. Show me all German highways with 3 lanes..."
          className="w-full px-6 py-4 text-lg border border-gray-300 rounded-full shadow-sm hover:shadow-md focus:shadow-md focus:outline-none focus:border-blue-400 transition-shadow dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          disabled={loading}
          aria-label="Natural language search query"
          aria-describedby="search-hint"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={loading ? 'Searching...' : 'Search'}
        >
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Search'
          )}
        </button>

        {/* History dropdown */}
        {showHistory && history.length > 0 && (
          <ul
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden"
            role="listbox"
            aria-label="Recent searches"
          >
            <li className="px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Recent searches
            </li>
            {history.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectHistory(h)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                  role="option"
                  aria-selected={false}
                >
                  <svg
                    className="w-3.5 h-3.5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {h}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id="search-hint" className="mt-2 text-xs text-gray-400 dark:text-gray-500 text-center">
        Describe what you&apos;re looking for in plain language. The AI will interpret your query
        against the ENVITED-X ontology domains.
      </p>
    </form>
  )
}
