/**
 * Cached SPARQL Store — decorates any SparqlStore with LRU query caching.
 *
 * Only caches SELECT/ASK queries. UPDATE and LOAD operations
 * invalidate the cache since they modify the underlying data.
 */
import { SparqlCache } from './cache.js'
import type { SparqlQueryOptions, SparqlResults, SparqlStore } from './types.js'

export class CachedSparqlStore implements SparqlStore {
  private readonly inner: SparqlStore
  private readonly cache: SparqlCache

  constructor(inner: SparqlStore, cacheOptions: { maxSize: number; ttlMs: number }) {
    this.inner = inner
    this.cache = new SparqlCache(cacheOptions)
  }

  async query(sparql: string, options?: SparqlQueryOptions): Promise<SparqlResults> {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const cached = this.cache.get(sparql)
    if (cached) return cached

    const results = await this.inner.query(sparql, options)
    this.cache.set(sparql, results)
    return results
  }

  async update(sparql: string): Promise<void> {
    await this.invalidateAndDelegate(() => this.inner.update(sparql))
  }

  async loadTurtle(data: string, graphUri?: string): Promise<void> {
    await this.invalidateAndDelegate(() => this.inner.loadTurtle(data, graphUri))
  }

  async loadJsonLd(data: string, graphUri?: string): Promise<void> {
    await this.invalidateAndDelegate(() => this.inner.loadJsonLd(data, graphUri))
  }

  /**
   * Invalidate the query cache and delegate a mutating operation to the
   * inner store. Used by update, loadTurtle, and loadJsonLd to ensure
   * stale cached results are never served after data changes.
   */
  private async invalidateAndDelegate(fn: () => Promise<void>): Promise<void> {
    this.cache.clear()
    return fn()
  }

  async isReady(): Promise<boolean> {
    return this.inner.isReady()
  }

  /** Get cache statistics */
  getCacheStats() {
    return this.cache.stats
  }

  /** Manually clear the cache */
  clearCache() {
    this.cache.clear()
  }
}
