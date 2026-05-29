import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../app.js'

vi.mock('../search-factory.js', () => ({
  searchNl: vi.fn(),
  searchRefine: vi.fn(),
}))

beforeEach(() => {
  // SSE handlers keep running asynchronously after `app.request` returns its
  // headers, so without this, later tests see mock calls from earlier ones.
  vi.clearAllMocks()
})

vi.mock('@ontology-search/search', () => ({
  getInitializedStore: vi.fn(),
  compileCountQuery: vi.fn(),
  getAssetDomains: vi.fn().mockResolvedValue(new Set(['hdmap', 'scenario'])),
  exploreLineage: vi.fn(),
  DEFAULT_LINEAGE_DEPTH: 3,
  MAX_LINEAGE_DEPTH: 6,
  getAssetMetadata: vi.fn(),
  getDomainMetadataAggregate: vi.fn(),
}))

vi.mock('@ontology-search/ontology/domain-registry', () => ({
  buildDomainRegistry: vi.fn(),
}))

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('includes x-request-id header', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })
})

describe('POST /search/stream', () => {
  it('returns 200 for valid request', async () => {
    const { searchNl } = await import('../search-factory.js')
    vi.mocked(searchNl).mockResolvedValue({
      interpretation: { query: 'test', intent: 'search', domains: ['hdmap'] },
      gaps: [],
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      execution: { results: [], error: undefined },
      meta: { matchCount: 0, executionTimeMs: 100 },
    })

    const res = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'find HD maps in Germany' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('returns SSE error for missing query', async () => {
    const res = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200) // SSE always 200, errors sent in stream
    const text = await res.text()
    expect(text).toContain('event: error')
    expect(text).toContain('Missing or invalid')
  })

  it('returns SSE error for invalid JSON', async () => {
    const res = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('event: error')
    expect(text).toContain('Invalid JSON')
  })

  /**
   * Regression for task 02: a client AbortSignal on the incoming HTTP request
   * must reach `searchNl({ signal })` so the LLM call, SPARQL execution, and
   * count-loop downstream are cancelled. Without this wiring the server
   * keeps spending compute on a request whose results no one will read.
   */
  it('forwards the request AbortSignal into searchNl', async () => {
    const { searchNl } = await import('../search-factory.js')
    vi.mocked(searchNl).mockResolvedValue({
      interpretation: { query: 'test', intent: 'search', domains: ['hdmap'] },
      gaps: [],
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      execution: { results: [], error: undefined },
      meta: { matchCount: 0, executionTimeMs: 100 },
    } as never)

    const controller = new AbortController()
    const res = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
      signal: controller.signal,
    })
    // Drain the SSE body so the handler runs through to completion before
    // we assert on the mock — app.request returns when headers flush, not
    // when the streaming handler finishes.
    await res.text()

    expect(searchNl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: 'test',
        signal: expect.any(AbortSignal),
      })
    )
    const passedSignal = vi.mocked(searchNl).mock.lastCall?.[0].signal as AbortSignal
    expect(passedSignal).toBeDefined()
    // The signal handed to the service must abort when the request signal aborts.
    controller.abort()
    expect(passedSignal.aborted).toBe(true)
  })

  /**
   * Regression for task 03: the middleware generates a requestId, sets it
   * on the context, AND returns it in the x-request-id response header.
   * The service used to ignore that and regenerate its own id, so the
   * header value and the SSE meta value were different. The fix threads
   * the middleware id through searchNl({ requestId }); this test asserts
   * both ends of that wire match the same id.
   */
  it('returns a response x-request-id that matches the requestId passed to searchNl', async () => {
    const { searchNl } = await import('../search-factory.js')
    vi.mocked(searchNl).mockImplementation(
      async (opts) =>
        ({
          // Echo the requestId the route passed in so the test can compare it
          // against the response header.
          interpretation: { query: 'test', intent: 'search', domains: ['hdmap'] },
          gaps: [],
          sparql: 'SELECT * WHERE { ?s ?p ?o }',
          execution: { results: [], error: undefined },
          meta: { matchCount: 0, executionTimeMs: 10, requestId: opts.requestId },
        }) as never
    )

    const res = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    })
    await res.text()

    const headerId = res.headers.get('x-request-id')
    expect(headerId).toBeTruthy()
    expect(vi.mocked(searchNl).mock.lastCall?.[0].requestId).toBe(headerId)
  })
})

describe('POST /search/refine', () => {
  it('returns 400 for missing slots field', async () => {
    const res = await app.request('/search/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('BAD_REQUEST')
  })

  it('returns 200 with results for valid slots', async () => {
    const { searchRefine } = await import('../search-factory.js')
    vi.mocked(searchRefine).mockResolvedValue({
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      execution: { results: [{ id: '1' }], error: undefined },
      meta: { matchCount: 1, executionTimeMs: 50 },
    })

    const res = await app.request('/search/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: { domains: ['hdmap'] } }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.results).toHaveLength(1)
    expect(json.sparql).toBeDefined()
    expect(json.meta.matchCount).toBe(1)
  })

  it('returns 422 for invalid slot shape', async () => {
    const res = await app.request('/search/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: { filters: { invalidProp: 123 } } }), // invalid filter type
    })
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.code).toBe('UNPROCESSABLE_ENTITY')
  })

  /**
   * Regression for task 02: the /refine endpoint must also propagate the
   * client AbortSignal so a slow SPARQL query is cancelled when the caller
   * disconnects, not just /stream.
   */
  it('forwards the request AbortSignal into searchRefine', async () => {
    const { searchRefine } = await import('../search-factory.js')
    vi.mocked(searchRefine).mockResolvedValue({
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      execution: { results: [], error: undefined },
      meta: { matchCount: 0, executionTimeMs: 10 },
    } as never)

    await app.request('/search/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: { domains: ['hdmap'] } }),
    })

    expect(searchRefine).toHaveBeenLastCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
  })

  /**
   * Same correlation invariant as /stream — the response header and the
   * requestId the route passed to searchRefine must be the same value.
   */
  it('returns a response x-request-id that matches the requestId passed to searchRefine', async () => {
    const { searchRefine } = await import('../search-factory.js')
    vi.mocked(searchRefine).mockImplementation(
      async (opts) =>
        ({
          sparql: 'SELECT * WHERE { ?s ?p ?o }',
          execution: { results: [], error: undefined },
          meta: { matchCount: 0, executionTimeMs: 10, requestId: opts.requestId },
        }) as never
    )

    const res = await app.request('/search/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: { domains: ['hdmap'] } }),
    })

    const headerId = res.headers.get('x-request-id')
    expect(headerId).toBeTruthy()
    expect(vi.mocked(searchRefine).mock.lastCall?.[0].requestId).toBe(headerId)
  })
})

describe('GET /traceability', () => {
  it('400s without an asset query parameter', async () => {
    const res = await app.request('/traceability')
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error || json.message).toMatch(/asset/i)
  })

  it('400s when depth is non-numeric', async () => {
    const res = await app.request('/traceability?asset=did%3Aweb%3Aexample%3Atest&depth=banana')
    expect(res.status).toBe(400)
  })

  it('returns the lineage node from exploreLineage on success', async () => {
    const { exploreLineage } = await import('@ontology-search/search')
    vi.mocked(exploreLineage).mockResolvedValue({
      asset: 'did:web:example:scenario-1',
      name: 'Scenario 1',
      type: 'https://example.org/scenario/Scenario',
      domain: 'scenario',
      references: [],
      truncated: false,
    })

    const res = await app.request(
      '/traceability?asset=' + encodeURIComponent('did:web:example:scenario-1')
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.node.asset).toBe('did:web:example:scenario-1')
    expect(json.node.references).toEqual([])
    expect(vi.mocked(exploreLineage)).toHaveBeenCalledWith('did:web:example:scenario-1', {
      depth: undefined,
    })
  })

  it('forwards a numeric depth to exploreLineage', async () => {
    const { exploreLineage } = await import('@ontology-search/search')
    vi.mocked(exploreLineage).mockResolvedValue({
      asset: 'did:web:example:scenario-1',
      name: 'Scenario 1',
      type: 'https://example.org/scenario/Scenario',
      domain: 'scenario',
      references: [],
      truncated: false,
    })

    const res = await app.request(
      '/traceability?asset=' + encodeURIComponent('did:web:example:scenario-1') + '&depth=2'
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(exploreLineage)).toHaveBeenCalledWith('did:web:example:scenario-1', {
      depth: 2,
    })
  })
})

describe('GET /metadata/asset', () => {
  it('400s when iri is missing', async () => {
    const res = await app.request('/metadata/asset')
    expect(res.status).toBe(400)
  })

  it('forwards the iri to getAssetMetadata and returns the snapshot', async () => {
    const { getAssetMetadata } = await import('@ontology-search/search')
    vi.mocked(getAssetMetadata).mockResolvedValue({
      asset: 'did:web:example:a',
      type: 'https://example.org/hdmap/HdMap',
      domain: 'hdmap',
      groups: {
        Quality: [{ property: 'precision', values: ['0.020'] }],
        Content: [{ property: 'roadTypes', values: ['motorway'] }],
      },
    })
    const res = await app.request('/metadata/asset?iri=' + encodeURIComponent('did:web:example:a'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.domain).toBe('hdmap')
    expect(json.groups.Quality[0].property).toBe('precision')
    expect(vi.mocked(getAssetMetadata)).toHaveBeenCalledWith('did:web:example:a')
  })
})

describe('GET /metadata/aggregate', () => {
  it('400s when domain or group is missing', async () => {
    expect((await app.request('/metadata/aggregate')).status).toBe(400)
    expect((await app.request('/metadata/aggregate?domain=hdmap')).status).toBe(400)
    expect((await app.request('/metadata/aggregate?group=Quality')).status).toBe(400)
  })

  it('forwards (domain, group) to getDomainMetadataAggregate', async () => {
    const { getDomainMetadataAggregate } = await import('@ontology-search/search')
    vi.mocked(getDomainMetadataAggregate).mockResolvedValue({
      domain: 'hdmap',
      group: 'Quality',
      assetCount: 117,
      properties: [
        {
          property: 'precision',
          totalValues: 117,
          distinctValues: 4,
          samples: ['0.020', '0.050', '0.100', '0.200'],
          numericRange: { min: 0.02, max: 0.2 },
        },
      ],
    })
    const res = await app.request('/metadata/aggregate?domain=hdmap&group=Quality')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.assetCount).toBe(117)
    expect(json.properties[0].numericRange).toEqual({ min: 0.02, max: 0.2 })
    expect(vi.mocked(getDomainMetadataAggregate)).toHaveBeenCalledWith('hdmap', 'Quality')
  })
})

describe('GET /stats', () => {
  it('returns stats with domain counts', async () => {
    const { getInitializedStore, compileCountQuery } = await import('@ontology-search/search')
    const { buildDomainRegistry } = await import('@ontology-search/ontology/domain-registry')

    vi.mocked(buildDomainRegistry).mockResolvedValue({
      domainNames: ['hdmap', 'scenario'],
      domains: new Map(),
    } as never)
    vi.mocked(compileCountQuery).mockResolvedValue('SELECT (COUNT(*) AS ?count) WHERE { ?s a ?o }')
    vi.mocked(getInitializedStore).mockResolvedValue({
      query: vi.fn().mockResolvedValue({ results: { bindings: [{ count: { value: '42' } }] } }),
    } as never)

    const res = await app.request('/stats')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.totalAssets).toBeGreaterThan(0)
    expect(json.availableDomains).toContain('hdmap')
  })
})
