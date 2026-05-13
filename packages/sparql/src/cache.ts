/**
 * LRU Cache for SPARQL query results.
 *
 * Avoids re-executing identical SPARQL queries within a configurable TTL.
 * Uses a Map-based LRU eviction strategy (Map preserves insertion order
 * and we move accessed entries to the end).
 *
 * Cache key: normalized SPARQL string (whitespace-collapsed).
 * Cache invalidation: TTL-based (default 5 minutes) + manual clear.
 *
 * @see Cormen et al., "Introduction to Algorithms" — LRU Cache
 */
import type { SparqlResults } from './types.js'

interface CacheEntry {
  results: SparqlResults
  timestamp: number
}

export class SparqlCache {
  private cache: Map<string, CacheEntry>
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(options?: { maxSize?: number; ttlMs?: number }) {
    this.maxSize = options?.maxSize ?? 256
    this.ttlMs = options?.ttlMs ?? 5 * 60 * 1000 // 5 minutes
    this.cache = new Map()
  }

  /** Normalize SPARQL for cache key (collapse whitespace) */
  private normalize(sparql: string): string {
    return sparql.replace(/\s+/g, ' ').trim()
  }

  /** Get cached result if it exists and hasn't expired */
  get(sparql: string): SparqlResults | null {
    const key = this.normalize(sparql)
    const entry = this.cache.get(key)

    if (!entry) return null

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return structuredClone(entry.results)
  }

  /** Store a result in the cache */
  set(sparql: string, results: SparqlResults): void {
    const key = this.normalize(sparql)

    // Remove if exists (to update position)
    this.cache.delete(key)

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) {
        this.cache.delete(oldest)
      }
    }

    this.cache.set(key, { results: structuredClone(results), timestamp: Date.now() })
  }

  /** Clear the entire cache */
  clear(): void {
    this.cache.clear()
  }

  /** Get current cache size */
  get size(): number {
    return this.cache.size
  }

  /** Get cache hit statistics */
  get stats(): { size: number; maxSize: number; ttlMs: number } {
    return { size: this.cache.size, maxSize: this.maxSize, ttlMs: this.ttlMs }
  }
}
