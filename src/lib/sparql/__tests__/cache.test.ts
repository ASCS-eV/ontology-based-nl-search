import { SparqlCache } from '../cache'
import type { SparqlResults } from '../types'

const mockResults: SparqlResults = {
  head: { vars: ['asset', 'name'] },
  results: {
    bindings: [
      { asset: { type: 'uri', value: 'urn:test:1' }, name: { type: 'literal', value: 'Test' } },
    ],
  },
}

describe('SparqlCache', () => {
  it('returns null for uncached queries', () => {
    const cache = new SparqlCache()
    expect(cache.get('SELECT * WHERE { ?s ?p ?o }')).toBeNull()
  })

  it('caches and retrieves query results', () => {
    const cache = new SparqlCache()
    const sparql = 'SELECT ?s WHERE { ?s a <Type> }'
    cache.set(sparql, mockResults)
    expect(cache.get(sparql)).toEqual(mockResults)
  })

  it('normalizes whitespace for cache keys', () => {
    const cache = new SparqlCache()
    cache.set('SELECT ?s  WHERE  { ?s a <Type> }', mockResults)
    expect(cache.get('SELECT ?s WHERE { ?s a <Type> }')).toEqual(mockResults)
  })

  it('evicts oldest entries when max size is reached', () => {
    const cache = new SparqlCache({ maxSize: 2 })
    cache.set('query1', mockResults)
    cache.set('query2', mockResults)
    cache.set('query3', mockResults)
    expect(cache.get('query1')).toBeNull()
    expect(cache.get('query2')).toEqual(mockResults)
    expect(cache.get('query3')).toEqual(mockResults)
    expect(cache.size).toBe(2)
  })

  it('expires entries after TTL', () => {
    const cache = new SparqlCache({ ttlMs: 50 })
    cache.set('query', mockResults)
    expect(cache.get('query')).toEqual(mockResults)

    // Simulate time passing
    jest.useFakeTimers()
    jest.advanceTimersByTime(60)
    expect(cache.get('query')).toBeNull()
    jest.useRealTimers()
  })

  it('moves accessed entries to most-recent position (LRU)', () => {
    const cache = new SparqlCache({ maxSize: 2 })
    cache.set('query1', mockResults)
    cache.set('query2', mockResults)
    // Access query1 to move it to most-recent
    cache.get('query1')
    // Now query2 should be evicted when we add query3
    cache.set('query3', mockResults)
    expect(cache.get('query1')).toEqual(mockResults)
    expect(cache.get('query2')).toBeNull()
  })

  it('clears all entries', () => {
    const cache = new SparqlCache()
    cache.set('q1', mockResults)
    cache.set('q2', mockResults)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('q1')).toBeNull()
  })

  it('reports stats', () => {
    const cache = new SparqlCache({ maxSize: 100, ttlMs: 60000 })
    cache.set('q1', mockResults)
    expect(cache.stats).toEqual({ size: 1, maxSize: 100, ttlMs: 60000 })
  })
})
