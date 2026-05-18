import { CachedSparqlStore } from '../cached-store.js'
import type { SparqlQueryOptions, SparqlResults, SparqlStore } from '../types.js'

const mockResults: SparqlResults = {
  head: { vars: ['s'] },
  results: {
    bindings: [{ s: { type: 'uri', value: 'urn:test:1' } }],
  },
}

/** Minimal in-memory store for testing cache invalidation behavior */
function createMockStore(): SparqlStore & { queryCalls: number } {
  const store = {
    queryCalls: 0,
    async query(_sparql: string, _options?: SparqlQueryOptions): Promise<SparqlResults> {
      store.queryCalls++
      return structuredClone(mockResults)
    },
    async update(_sparql: string): Promise<void> {},
    async loadTurtle(_data: string, _graphUri?: string): Promise<void> {},
    async loadJsonLd(_data: string, _graphUri?: string): Promise<void> {},
    async isReady(): Promise<boolean> {
      return true
    },
  }
  return store
}

describe('CachedSparqlStore', () => {
  describe('cache invalidation on data mutation', () => {
    it('invalidates cache when loadTurtle is called', async () => {
      const inner = createMockStore()
      const cached = new CachedSparqlStore(inner)

      // Populate cache
      await cached.query('SELECT ?s WHERE { ?s ?p ?o }')
      expect(inner.queryCalls).toBe(1)

      // Cache hit — no new query to inner
      await cached.query('SELECT ?s WHERE { ?s ?p ?o }')
      expect(inner.queryCalls).toBe(1)

      // loadTurtle should invalidate
      await cached.loadTurtle('<s> <p> "o" .')

      // Next query should hit inner store
      await cached.query('SELECT ?s WHERE { ?s ?p ?o }')
      expect(inner.queryCalls).toBe(2)
    })

    it('invalidates cache when loadJsonLd is called', async () => {
      const inner = createMockStore()
      const cached = new CachedSparqlStore(inner)

      // Populate cache
      await cached.query('SELECT ?s WHERE { ?s ?p ?o }')
      expect(inner.queryCalls).toBe(1)

      // loadJsonLd should invalidate
      await cached.loadJsonLd('{"@id": "urn:test"}')

      // Next query should hit inner store
      await cached.query('SELECT ?s WHERE { ?s ?p ?o }')
      expect(inner.queryCalls).toBe(2)
    })

    it('invalidates cache when update is called', async () => {
      const inner = createMockStore()
      const cached = new CachedSparqlStore(inner)

      // Populate cache
      await cached.query('SELECT ?s WHERE { ?s ?p ?o }')
      expect(inner.queryCalls).toBe(1)

      // update should invalidate
      await cached.update('INSERT DATA { <s> <p> "o" }')

      // Next query should hit inner store
      await cached.query('SELECT ?s WHERE { ?s ?p ?o }')
      expect(inner.queryCalls).toBe(2)
    })
  })

  describe('delegation', () => {
    it('delegates isReady to inner store', async () => {
      const inner = createMockStore()
      const cached = new CachedSparqlStore(inner)
      expect(await cached.isReady()).toBe(true)
    })

    it('throws AbortError when signal is already aborted', async () => {
      const inner = createMockStore()
      const cached = new CachedSparqlStore(inner)
      const controller = new AbortController()
      controller.abort()

      await expect(
        cached.query('SELECT ?s WHERE { ?s ?p ?o }', { signal: controller.signal })
      ).rejects.toThrow('Aborted')
    })
  })
})
