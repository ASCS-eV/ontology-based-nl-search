import { useCallback, useEffect, useState } from 'react'

const HISTORY_KEY = 'nl-search-history'
const MAX_HISTORY = 10

function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    // intentional: corrupted localStorage — clear and start fresh
    console.warn('SearchHistory: corrupted localStorage entry, resetting')
    localStorage.removeItem(HISTORY_KEY)
    return []
  }
}

/**
 * Hook managing search query history in localStorage.
 * Provides the history list and a function to add new entries.
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    setHistory(readHistory())
  }, [])

  const addToHistory = useCallback((query: string) => {
    const current = readHistory().filter((h) => h !== query)
    current.unshift(query)
    const trimmed = current.slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
    setHistory(trimmed)
  }, [])

  return { history, addToHistory }
}
