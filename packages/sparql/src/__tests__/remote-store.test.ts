import { RemoteSparqlStore } from '../remote-store.js'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('RemoteSparqlStore', () => {
  let store: RemoteSparqlStore

  beforeEach(() => {
    store = new RemoteSparqlStore('http://localhost:3030/envited/sparql')
    mockFetch.mockReset()
  })

  describe('isReady', () => {
    it('should return true when endpoint responds OK', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      expect(await store.isReady()).toBe(true)
    })

    it('should return false when endpoint is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))
      expect(await store.isReady()).toBe(false)
    })

    it('should return false when endpoint returns error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })
      expect(await store.isReady()).toBe(false)
    })
  })

  describe('query', () => {
    it('should send SPARQL query with correct headers', async () => {
      const mockResults = {
        head: { vars: ['s'] },
        results: { bindings: [] },
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      })

      const sparql = 'SELECT ?s WHERE { ?s ?p ?o } LIMIT 10'
      const results = await store.query(sparql)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3030/envited/sparql',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/sparql-query',
            Accept: 'application/sparql-results+json',
          },
          body: sparql,
        })
      )
      expect(results).toEqual(mockResults)
    })

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Parse error'),
      })

      await expect(store.query('INVALID SPARQL')).rejects.toThrow('SPARQL query failed (400)')
    })
  })

  describe('update', () => {
    it('should send update to the update endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const sparql = 'INSERT DATA { <http://ex.org/s> <http://ex.org/p> "o" . }'
      await store.update(sparql)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3030/envited/update',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/sparql-update',
          },
          body: sparql,
        })
      )
    })

    it('should throw on failed update', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      })

      await expect(store.update('INVALID')).rejects.toThrow('SPARQL update failed (500)')
    })
  })

  describe('loadTurtle', () => {
    it('should POST turtle data to the data endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const turtle = '@prefix ex: <http://example.org/> .\nex:s ex:p "o" .'
      await store.loadTurtle(turtle)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3030/envited/data?default',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'text/turtle' },
          body: turtle,
        })
      )
    })

    it('should use graph parameter when specified', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await store.loadTurtle('data', 'http://example.org/graph')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3030/envited/data?graph=http%3A%2F%2Fexample.org%2Fgraph',
        expect.anything()
      )
    })
  })

  describe('loadJsonLd', () => {
    it('should POST JSON-LD data with correct content type', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const jsonld = '{"@context": {}, "@id": "http://example.org/s"}'
      await store.loadJsonLd(jsonld)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3030/envited/data?default',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/ld+json' },
          body: jsonld,
        })
      )
    })
  })
})
