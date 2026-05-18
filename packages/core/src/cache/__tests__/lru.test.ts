/**
 * Pin the LRU semantics every caller relies on:
 *   - hard bound on retained entries
 *   - reads promote the entry to most-recently-used
 *   - overflow evicts the LRU (oldest by access time)
 *   - optional TTL evicts on read past the deadline
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LruCache } from '../lru.js'

describe('LruCache — size bound', () => {
  it('rejects non-positive maxSize', () => {
    expect(() => new LruCache({ maxSize: 0 })).toThrow()
    expect(() => new LruCache({ maxSize: -1 })).toThrow()
  })

  it('returns undefined on miss', () => {
    const cache = new LruCache<string, number>({ maxSize: 2 })
    expect(cache.get('absent')).toBeUndefined()
    expect(cache.has('absent')).toBe(false)
    expect(cache.size).toBe(0)
  })

  it('stores and retrieves values up to capacity', () => {
    const cache = new LruCache<string, number>({ maxSize: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.size).toBe(3)
  })

  it('evicts the least-recently-used entry on overflow', () => {
    const cache = new LruCache<string, number>({ maxSize: 3 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    // Access 'a' so 'b' becomes the LRU.
    expect(cache.get('a')).toBe(1)
    // Insertion of 'd' must evict 'b'.
    cache.set('d', 4)
    expect(cache.size).toBe(3)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
    expect(cache.has('d')).toBe(true)
  })

  it('re-inserts an existing key without growing past capacity', () => {
    const cache = new LruCache<string, number>({ maxSize: 2 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 99) // refresh 'a' to MRU
    expect(cache.size).toBe(2)
    // 'b' is now the LRU; adding 'c' evicts it.
    cache.set('c', 3)
    expect(cache.get('a')).toBe(99)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
  })

  it('exposes the configured capacity', () => {
    expect(new LruCache({ maxSize: 4 }).capacity).toBe(4)
  })
})

describe('LruCache — TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats entries older than ttlMs as misses on read', () => {
    const cache = new LruCache<string, number>({ maxSize: 2, ttlMs: 1_000 })
    cache.set('a', 1)
    vi.advanceTimersByTime(500)
    expect(cache.get('a')).toBe(1) // still fresh
    vi.advanceTimersByTime(600) // total 1100 > ttl
    expect(cache.get('a')).toBeUndefined()
    expect(cache.size).toBe(0) // evicted on read
  })

  it('has() respects TTL too', () => {
    const cache = new LruCache<string, number>({ maxSize: 2, ttlMs: 100 })
    cache.set('a', 1)
    expect(cache.has('a')).toBe(true)
    vi.advanceTimersByTime(101)
    expect(cache.has('a')).toBe(false)
  })

  it('omitting ttlMs keeps entries indefinitely', () => {
    const cache = new LruCache<string, number>({ maxSize: 2 })
    cache.set('a', 1)
    vi.advanceTimersByTime(1_000_000)
    expect(cache.get('a')).toBe(1)
  })
})

describe('LruCache — mutation', () => {
  it('delete returns true when an entry was present', () => {
    const cache = new LruCache<string, number>({ maxSize: 2 })
    cache.set('a', 1)
    expect(cache.delete('a')).toBe(true)
    expect(cache.delete('a')).toBe(false)
    expect(cache.size).toBe(0)
  })

  it('clear drops every entry', () => {
    const cache = new LruCache<string, number>({ maxSize: 4 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.has('a')).toBe(false)
  })
})
