import { useCallback, useEffect, useState } from 'react'

const MAX_HISTORY = 10

function readHistory(storageKey: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
  } catch {
    return reset(storageKey)
  }
  // localStorage is user-writable and shared across app versions, so a
  // syntactically valid entry can still be the wrong shape. Anything that is
  // not a list of strings would break `addToHistory`'s filter/unshift.
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
    return reset(storageKey)
  }
  return parsed as string[]
}

/** Discard an unusable stored history and start fresh. */
function reset(storageKey: string): string[] {
  console.warn(`useQueryHistory: corrupted localStorage entry for "${storageKey}", resetting`)
  localStorage.removeItem(storageKey)
  return []
}

/**
 * Hook managing natural-language query history in localStorage, keyed by
 * `storageKey` — shared logic behind both the search feature's history
 * (`nl-search-history`) and the authoring feature's history
 * (`nl-author-history`), so each keeps its own independent, non-colliding
 * list under the same 10-entry, most-recent-first, deduplicated behavior.
 */
export function useQueryHistory(storageKey: string) {
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    setHistory(readHistory(storageKey))
  }, [storageKey])

  const addToHistory = useCallback(
    (query: string) => {
      const current = readHistory(storageKey).filter((h) => h !== query)
      current.unshift(query)
      const trimmed = current.slice(0, MAX_HISTORY)
      localStorage.setItem(storageKey, JSON.stringify(trimmed))
      setHistory(trimmed)
    },
    [storageKey]
  )

  return { history, addToHistory }
}
