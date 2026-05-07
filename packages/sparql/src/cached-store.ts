/**
 * Cached SPARQL Store — decorates any SparqlStore with LRU query caching.
 *
 * Only caches SELECT/ASK queries. UPDATE and LOAD operations
 * invalidate the cache since they modify the underlying data.
 */
import { SparqlCache } from './cache.js'
import type { SparqlResults, SparqlStore } from './types.js'

export class CachedSparqlStore implements SparqlStore {
  private readonly inner: SparqlStore
  private readonly cache: SparqlCache

  constructor(inner: SparqlStore, cacheOptions?: { maxSize?: number; ttlMs?: number }) {
    this.inner = inner
    this.cache = new SparqlCache(cacheOptions)
  }

  async query(sparql: string): Promise<SparqlResults> {
    const cached = this.cache.get(sparql)
    if (cached) return cached

    const results = await this.inner.query(sparql)
    this.cache.set(sparql, results)
    return results
  }

  async update(sparql: string): Promise<void> {
    // Invalidate cache on data mutation
    this.cache.clear()
    return this.inner.update(sparql)
  }

  async loadTurtle(data: string, graphUri?: string): Promise<void> {
    this.cache.clear()
    return this.inner.loadTurtle(data, graphUri)
  }

  async loadJsonLd(data: string, graphUri?: string): Promise<void> {
    this.cache.clear()
    return this.inner.loadJsonLd(data, graphUri)
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
