/**
 * Generic in-memory LRU cache.
 *
 * Bounded by `maxSize`; on insertion that would exceed the bound the
 * least-recently-used entry is evicted. Optional `ttlMs` invalidates
 * entries older than the configured age on read. Designed for any
 * key-value workload that needs predictable memory under long-running
 * processes — long-lived servers, validators, query result caches.
 *
 * Uses the well-known Map-iteration-order LRU pattern: on hit, delete
 * and re-insert so the entry moves to the end (newest); on overflow,
 * delete the first key (oldest). Both operations are O(1).
 *
 * @see Cormen et al., "Introduction to Algorithms" — LRU Cache
 */

export interface LruCacheOptions {
  /** Maximum number of entries the cache will retain. Required. */
  maxSize: number
  /**
   * Entry lifetime in milliseconds. Entries older than this on read
   * count as misses and are evicted. Omit for "size-bounded only".
   */
  ttlMs?: number
}

interface Entry<V> {
  value: V
  timestamp: number
}

export class LruCache<K, V> {
  private readonly maxSize: number
  private readonly ttlMs: number | undefined
  private readonly entries: Map<K, Entry<V>> = new Map()

  constructor(options: LruCacheOptions) {
    if (options.maxSize <= 0) {
      throw new Error(`LruCache maxSize must be positive; got ${options.maxSize}`)
    }
    this.maxSize = options.maxSize
    this.ttlMs = options.ttlMs
  }

  /**
   * Return the cached value for `key`, or `undefined` if the entry is
   * absent or expired. Records the access by moving the entry to the
   * end of the iteration order so it survives the next eviction round.
   */
  get(key: K): V | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined

    if (this.ttlMs !== undefined && Date.now() - entry.timestamp > this.ttlMs) {
      this.entries.delete(key)
      return undefined
    }

    // Move to end (most-recently-used).
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  /** True iff `get(key)` would return a live (non-expired) value. */
  has(key: K): boolean {
    const entry = this.entries.get(key)
    if (!entry) return false
    if (this.ttlMs !== undefined && Date.now() - entry.timestamp > this.ttlMs) {
      this.entries.delete(key)
      return false
    }
    return true
  }

  /**
   * Insert or refresh `key`. If the cache is at capacity AND `key` is
   * new, the least-recently-used entry is evicted to make room.
   */
  set(key: K, value: V): void {
    // Re-insertion: delete first so the entry moves to the end.
    if (this.entries.has(key)) {
      this.entries.delete(key)
    } else if (this.entries.size >= this.maxSize) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest as K)
    }
    this.entries.set(key, { value, timestamp: Date.now() })
  }

  /** Remove a single entry; returns true iff something was deleted. */
  delete(key: K): boolean {
    return this.entries.delete(key)
  }

  /** Drop every entry. */
  clear(): void {
    this.entries.clear()
  }

  /** Current entry count. Cheap O(1). */
  get size(): number {
    return this.entries.size
  }

  /** Hard bound the cache cannot exceed. */
  get capacity(): number {
    return this.maxSize
  }
}
