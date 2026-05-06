'use client'

import { useState, FormEvent } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading?: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input.trim() && !loading) {
      onSearch(input.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Show me all German highways with 3 lanes..."
          className="w-full px-6 py-4 text-lg border border-gray-300 rounded-full shadow-sm hover:shadow-md focus:shadow-md focus:outline-none focus:border-blue-400 transition-shadow dark:bg-gray-900 dark:border-gray-700 dark:text-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Search'
          )}
        </button>
      </div>
    </form>
  )
}
