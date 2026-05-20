import { WorkerOxigraphStore } from '../worker-oxigraph-store.js'

describe('WorkerOxigraphStore', () => {
  let store: WorkerOxigraphStore

  beforeEach(() => {
    store = new WorkerOxigraphStore()
  })

  afterEach(async () => {
    await store.terminate()
  })

  describe('initialization', () => {
    it('should report not ready before initialization', async () => {
      expect(await store.isReady()).toBe(false)
    })

    it('should auto-initialize on first query', async () => {
      const results = await store.query('SELECT ?s WHERE { ?s ?p ?o } LIMIT 1')
      expect(results).toHaveProperty('head')
      expect(results).toHaveProperty('results')
      expect(await store.isReady()).toBe(true)
    })
  })

  describe('loadTurtle', () => {
    it('should load valid Turtle data', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate "object" .
      `
      await store.loadTurtle(turtle)

      const results = await store.query(
        'SELECT ?o WHERE { <http://example.org/subject> <http://example.org/predicate> ?o }'
      )
      expect(results.results.bindings).toHaveLength(1)
      expect(results.results.bindings[0]!.o!.value).toBe('object')
    })

    it('should load data into a named graph', async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:s ex:p "value" .
      `
      await store.loadTurtle(turtle, 'http://example.org/graph1')

      const results = await store.query(`
        SELECT ?o WHERE {
          GRAPH <http://example.org/graph1> {
            <http://example.org/s> <http://example.org/p> ?o
          }
        }
      `)
      expect(results.results.bindings).toHaveLength(1)
      expect(results.results.bindings[0]!.o!.value).toBe('value')
    })
  })

  describe('query', () => {
    beforeEach(async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

        ex:asset1 a ex:SimulationAsset ;
          rdfs:label "Highway A9"@en ;
          ex:country "Germany" ;
          ex:lanes "3"^^xsd:integer .

        ex:asset2 a ex:SimulationAsset ;
          rdfs:label "Urban Road B27"@en ;
          ex:country "Germany" ;
          ex:lanes "2"^^xsd:integer .

        ex:asset3 a ex:SimulationAsset ;
          rdfs:label "Vienna Ring"@en ;
          ex:country "Austria" ;
          ex:lanes "2"^^xsd:integer .
      `
      await store.loadTurtle(turtle)
    })

    it('should return correct SPARQL JSON result format', async () => {
      const results = await store.query(`
        SELECT ?asset ?label WHERE {
          ?asset a <http://example.org/SimulationAsset> .
          ?asset <http://www.w3.org/2000/01/rdf-schema#label> ?label .
        }
      `)

      expect(results.head.vars).toContain('asset')
      expect(results.head.vars).toContain('label')
      expect(results.results.bindings.length).toBe(3)
    })

    it('should handle FILTER correctly', async () => {
      const results = await store.query(`
        PREFIX ex: <http://example.org/>
        SELECT ?asset ?label WHERE {
          ?asset a ex:SimulationAsset .
          ?asset <http://www.w3.org/2000/01/rdf-schema#label> ?label .
          ?asset ex:country "Germany" .
        }
      `)

      expect(results.results.bindings.length).toBe(2)
    })

    it('should return URI type for resources', async () => {
      const results = await store.query(`
        SELECT ?asset WHERE {
          ?asset a <http://example.org/SimulationAsset> .
        } LIMIT 1
      `)

      expect(results.results.bindings[0]!.asset!.type).toBe('uri')
    })

    it('should return literal type for values', async () => {
      const results = await store.query(`
        SELECT ?country WHERE {
          <http://example.org/asset1> <http://example.org/country> ?country .
        }
      `)

      expect(results.results.bindings[0]!.country!.type).toBe('literal')
      expect(results.results.bindings[0]!.country!.value).toBe('Germany')
    })

    it('should handle empty results', async () => {
      const results = await store.query(`
        SELECT ?asset WHERE {
          ?asset a <http://example.org/NonExistent> .
        }
      `)

      expect(results.results.bindings).toHaveLength(0)
    })
  })

  describe('update', () => {
    it('should insert triples via SPARQL UPDATE', async () => {
      await store.update(`
        INSERT DATA {
          <http://example.org/new> <http://example.org/prop> "new value" .
        }
      `)

      const results = await store.query(`
        SELECT ?o WHERE {
          <http://example.org/new> <http://example.org/prop> ?o .
        }
      `)

      expect(results.results.bindings).toHaveLength(1)
      expect(results.results.bindings[0]!.o!.value).toBe('new value')
    })
  })

  describe('concurrent queries', () => {
    beforeEach(async () => {
      const turtle = `
        @prefix ex: <http://example.org/> .
        ex:a ex:p "1" .
        ex:b ex:p "2" .
        ex:c ex:p "3" .
      `
      await store.loadTurtle(turtle)
    })

    it('should handle multiple concurrent queries without blocking', async () => {
      const queries = Array.from({ length: 10 }, (_, i) =>
        store.query(`SELECT ?s WHERE { ?s <http://example.org/p> "${(i % 3) + 1}" }`)
      )

      const results = await Promise.all(queries)
      for (const result of results) {
        expect(result.results.bindings.length).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('abort signal', () => {
    it('should reject with AbortError when signal is pre-aborted', async () => {
      await store.initialize()
      const controller = new AbortController()
      controller.abort()

      await expect(
        store.query('SELECT ?s WHERE { ?s ?p ?o } LIMIT 1', { signal: controller.signal })
      ).rejects.toThrow('Aborted')
    })

    it('should abort an in-flight query and clean up the pending map', async () => {
      await store.initialize()
      const controller = new AbortController()

      // Start a query, then abort while it's in-flight
      const queryPromise = store.query('SELECT ?s WHERE { ?s ?p ?o } LIMIT 1', {
        signal: controller.signal,
      })

      // Abort immediately — the worker is processing but the main thread
      // should reject and clean up without waiting for the response
      controller.abort()

      await expect(queryPromise).rejects.toThrow('Aborted')

      // Verify pending map was cleaned up (no memory/listener leak)
      expect((store as any).pending.size).toBe(0)
    })
  })

  describe('terminate', () => {
    it('should be safe to call terminate multiple times', async () => {
      await store.initialize()
      await store.terminate()
      await store.terminate() // idempotent
      expect(await store.isReady()).toBe(false)
    })
  })
})
