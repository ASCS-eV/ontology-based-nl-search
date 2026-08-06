/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useQueryHistory } from '../useQueryHistory'

const SEARCH_KEY = 'nl-search-history'
const AUTHOR_KEY = 'nl-author-history'

describe('useQueryHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts with empty history', () => {
    const { result } = renderHook(() => useQueryHistory(SEARCH_KEY))
    expect(result.current.history).toEqual([])
  })

  it('adds a query to history', () => {
    const { result } = renderHook(() => useQueryHistory(SEARCH_KEY))
    act(() => result.current.addToHistory('test query'))
    expect(result.current.history).toEqual(['test query'])
  })

  it('deduplicates and moves the repeated entry to the front', () => {
    const { result } = renderHook(() => useQueryHistory(SEARCH_KEY))
    act(() => result.current.addToHistory('first'))
    act(() => result.current.addToHistory('second'))
    act(() => result.current.addToHistory('first'))
    expect(result.current.history).toEqual(['first', 'second'])
  })

  it('caps at 10 entries, most recent first', () => {
    const { result } = renderHook(() => useQueryHistory(SEARCH_KEY))
    for (let i = 0; i < 15; i++) {
      act(() => result.current.addToHistory(`query ${i}`))
    }
    expect(result.current.history).toHaveLength(10)
    expect(result.current.history[0]).toBe('query 14')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(SEARCH_KEY, 'not valid json {{{')
    const { result } = renderHook(() => useQueryHistory(SEARCH_KEY))
    expect(result.current.history).toEqual([])
  })

  /**
   * localStorage is user-writable and outlives app versions, so a stored entry
   * can be valid JSON of the wrong shape. Such an entry must be discarded
   * rather than handed to `addToHistory`, whose filter/unshift assume a list
   * of strings.
   */
  it.each([
    ['an object', '{"first":"query"}'],
    ['a bare string', '"just a string"'],
    ['a list of non-strings', '[1, 2, 3]'],
  ])('discards stored history that is %s', (_shape, stored) => {
    localStorage.setItem(SEARCH_KEY, stored)
    const { result } = renderHook(() => useQueryHistory(SEARCH_KEY))

    expect(result.current.history).toEqual([])
    act(() => result.current.addToHistory('a real query'))
    expect(result.current.history).toEqual(['a real query'])
  })

  /**
   * The reason this hook takes a storage key at all: search and authoring
   * each keep their own history and must never see the other's entries, even
   * though both mount the same hook.
   */
  it('keeps two different storage keys fully independent', () => {
    const search = renderHook(() => useQueryHistory(SEARCH_KEY))
    const author = renderHook(() => useQueryHistory(AUTHOR_KEY))

    act(() => search.result.current.addToHistory('motorways in Germany'))
    act(() => author.result.current.addToHistory('a cut-in on a three-lane highway'))

    expect(search.result.current.history).toEqual(['motorways in Germany'])
    expect(author.result.current.history).toEqual(['a cut-in on a three-lane highway'])
  })
})
