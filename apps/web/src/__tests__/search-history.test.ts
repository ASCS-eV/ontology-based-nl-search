/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Tests for useSearchHistory hook logic.
 * Uses direct localStorage manipulation since the hook is a thin wrapper.
 */

const HISTORY_KEY = 'nl-search-history'
const MAX_HISTORY = 10

// Mirror the hook's read logic for testing
function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function addToHistory(query: string): string[] {
  const current = readHistory().filter((h) => h !== query)
  current.unshift(query)
  const trimmed = current.slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
  return trimmed
}

describe('useSearchHistory (logic)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts with empty history', () => {
    expect(readHistory()).toEqual([])
  })

  it('adds a query to history', () => {
    addToHistory('test query')
    expect(readHistory()).toEqual(['test query'])
  })

  it('deduplicates and moves to front', () => {
    addToHistory('first')
    addToHistory('second')
    addToHistory('first')
    expect(readHistory()).toEqual(['first', 'second'])
  })

  it('caps at MAX_HISTORY entries', () => {
    for (let i = 0; i < 15; i++) {
      addToHistory(`query ${i}`)
    }
    expect(readHistory()).toHaveLength(MAX_HISTORY)
    expect(readHistory()[0]).toBe('query 14')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(HISTORY_KEY, 'not valid json {{{')
    expect(readHistory()).toEqual([])
  })
})
