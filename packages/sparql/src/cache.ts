/**
 * LRU Cache for SPARQL query results.
 *
 * Avoids re-executing identical SPARQL queries within a configurable TTL.
 * Uses a Map-based LRU eviction strategy (Map preserves insertion order
 * and we move accessed entries to the end).
 *
 * Cache key: normalized SPARQL string (whitespace-collapsed).
 * Cache invalidation: TTL-based + manual clear.
 *
 * Both `maxSize` and `ttlMs` are required at construction. Production
 * callers source them from `getConfig().SPARQL_CACHE_SIZE` and
 * `SPARQL_CACHE_TTL_MS` via the `getSparqlStore()` wrapper — this class
 * is intentionally agnostic of the env layer so its values are not
 * silently duplicated.
 *
 * @see Cormen et al., "Introduction to Algorithms" — LRU Cache
 */
import type { SparqlResults } from './types.js'

interface CacheEntry {
  results: SparqlResults
  timestamp: number
}

/**
 * Recursively freeze a value so it can be shared across cache callers
 * without defensive copying. The previous implementation `structuredClone`d
 * the entire result set on every `get` AND `set` — an O(rows × cols) deep
 * copy on the request hot path (cache HITs especially). Results here are a
 * read-only plain-data DTO (callers only read `.value` and build new rows),
 * so a one-time freeze at `set` lets `get` return the stored reference with
 * zero copy, while still preventing a caller from mutating another's results.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}

export class SparqlCache {
  private cache: Map<string, CacheEntry>
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(options: { maxSize: number; ttlMs: number }) {
    this.maxSize = options.maxSize
    this.ttlMs = options.ttlMs
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

    // Return the stored, deep-frozen reference directly — no per-hit clone.
    return entry.results
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

    this.cache.set(key, { results: deepFreeze(results), timestamp: Date.now() })
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
