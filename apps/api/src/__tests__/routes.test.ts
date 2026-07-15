import type { VocabularyResponse } from '@ontology-search/api-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../app.js'
import { resetGraphQLContractForTests } from '../graphql-schema.js'
import { setReadiness } from '../readiness.js'

const ZERO_TIMINGS = { storeMs: 0, vocabMs: 0, compilerMs: 0, shaclMs: 0, sessionMs: 0 }

vi.mock('../search-factory.js', () => ({
  searchNl: vi.fn(),
  searchRefine: vi.fn(),
}))

beforeEach(() => {
  // SSE handlers keep running asynchronously after `app.request` returns its
  // headers, so without this, later tests see mock calls from earlier ones.
  vi.clearAllMocks()
  resetGraphQLContractForTests()
})

vi.mock('@ontology-search/search', () => ({
  getInitializedStore: vi.fn(),
  compileCountQuery: vi.fn(),
  getAssetDomains: vi.fn().mockResolvedValue(new Set(['hdmap', 'scenario'])),
  normalizeReferences: (v: unknown) => (!v ? [] : Array.isArray(v) ? v : [v]),
  exploreLineage: vi.fn(),
  DEFAULT_LINEAGE_DEPTH: 3,
  MAX_LINEAGE_DEPTH: 6,
  getAssetMetadata: vi.fn(),
  getDomainMetadataAggregate: vi.fn(),
  slotsToGraphQL: () => 'query { }',
  extractSchemaVocabulary: vi.fn(),
  buildTermIndex: vi.fn(),
  toVocabularyResponse: vi.fn(),
  getInstanceValues: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock('@ontology-search/ontology/domain-registry', () => ({
  buildDomainRegistry: vi.fn(),
}))

describe('GET /health', () => {
  // This block first asserts the pre-warmup "starting" state (module-global
  // readiness is null until index.ts records it), then drives the ok/degraded
  // states. Regression for the first-run gap: /health used to return a static
  // `{ status: 'ok' }`, so an instance with no ontology loaded (warmup
  // degraded) looked healthy while every search came back empty.
  it('returns 503 "starting" before warmup records readiness', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'starting' })
  })

  it('returns 200 "ok" once warmup succeeded', async () => {
    setReadiness({ ready: true, errors: [], timings: ZERO_TIMINGS })
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('returns 503 "degraded" with the errors when warmup failed', async () => {
    setReadiness({
      ready: false,
      errors: ['SPARQL store + capability probe failed: No ontology shape files'],
      timings: ZERO_TIMINGS,
    })
    const res = await app.request('/health')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      status: 'degraded',
      errors: ['SPARQL store + capability probe failed: No ontology shape files'],
    })
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

  /**
   * Regression: the wire schema must accept `references` so the refine
   * path can reach the cross-reference JOIN compiler — without it,
   * `references: { domain: 'hdmap' }` was silently stripped, the
   * response had no `?refAsset` rows, and the AssetCard / lineage UI
   * never rendered. Verified end-to-end in the browser during manual end-to-end verification.
   */
  it('forwards a `references` slot through to the service', async () => {
    const { searchRefine } = await import('../search-factory.js')
    vi.mocked(searchRefine).mockResolvedValue({
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      execution: { results: [], error: undefined },
      meta: { matchCount: 0, executionTimeMs: 10 },
    })

    const res = await app.request('/search/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: {
          domains: ['scenario'],
          filters: {},
          ranges: {},
          references: { domain: 'hdmap', label: 'Munich' },
        },
      }),
    })

    expect(res.status).toBe(200)
    const lastCall = vi.mocked(searchRefine).mock.lastCall?.[0]
    // The legacy single-object form is normalized to the array the compiler
    // expects (multi-reference support).
    expect(lastCall?.slots.references).toEqual([{ domain: 'hdmap', label: 'Munich' }])
  })

  it('forwards an ARRAY of `references` (multi-reference) through to the service', async () => {
    const { searchRefine } = await import('../search-factory.js')
    vi.mocked(searchRefine).mockResolvedValue({
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      execution: { results: [], error: undefined },
      meta: { matchCount: 0, executionTimeMs: 10 },
    })

    const res = await app.request('/search/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: {
          domains: ['scenario'],
          filters: {},
          ranges: {},
          references: [{ domain: 'ositrace' }, { domain: 'hdmap', label: 'Munich' }],
        },
      }),
    })

    expect(res.status).toBe(200)
    const lastCall = vi.mocked(searchRefine).mock.lastCall?.[0]
    expect(lastCall?.slots.references).toEqual([
      { domain: 'ositrace' },
      { domain: 'hdmap', label: 'Munich' },
    ])
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

describe('POST /search/refine-graphql', () => {
  const vocabulary: VocabularyResponse = {
    domains: ['asset-domain'],
    properties: [
      {
        name: 'lane-count',
        label: 'Lane count',
        description: 'A free-form lane count label.',
        domain: 'asset-domain',
        type: 'string',
      },
    ],
  }

  beforeEach(async () => {
    const { buildTermIndex, getInitializedStore, toVocabularyResponse } =
      await import('@ontology-search/search')
    const { searchRefine } = await import('../search-factory.js')
    vi.mocked(getInitializedStore).mockResolvedValue({} as never)
    vi.mocked(buildTermIndex).mockResolvedValue({} as never)
    vi.mocked(toVocabularyResponse).mockReturnValue(vocabulary)
    vi.mocked(searchRefine).mockResolvedValue({
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      execution: { results: [{ id: 'asset-1' }], error: undefined },
      meta: { matchCount: 1, executionTimeMs: 10 },
    })
  })

  const request = (body: string) =>
    app.request('/search/refine-graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

  it('retains the request-shape 400 responses', async () => {
    expect((await request('not json')).status).toBe(400)
    expect((await request(JSON.stringify({}))).status).toBe(400)
    expect((await request(JSON.stringify({ graphql: '  ' }))).status).toBe(400)
  })

  it('returns 422 for malformed GraphQL', async () => {
    const response = await request(JSON.stringify({ graphql: 'query {' }))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'UNPROCESSABLE_ENTITY' })
  })

  it('rejects parseable unknown fields before execution', async () => {
    const { searchRefine } = await import('../search-factory.js')
    const response = await request(
      JSON.stringify({ graphql: 'query { asset_domain { unknown(values: ["x"]) } }' })
    )
    expect(response.status).toBe(422)
    expect(searchRefine).not.toHaveBeenCalled()
  })

  it('rejects a parseable unknown domain before execution', async () => {
    const { searchRefine } = await import('../search-factory.js')
    const response = await request(JSON.stringify({ graphql: 'query { unknown { _all } }' }))
    expect(response.status).toBe(422)
    expect(searchRefine).not.toHaveBeenCalled()
  })

  it('accepts a free-form string field and restores raw ontology names', async () => {
    const { searchRefine } = await import('../search-factory.js')
    const response = await request(
      JSON.stringify({
        graphql: 'query { asset_domain { lane_count(values: ["two"]) } }',
      })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      results: [{ id: 'asset-1' }],
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      meta: { matchCount: 1 },
    })
    expect(searchRefine).toHaveBeenCalledWith(
      expect.objectContaining({
        slots: {
          domains: ['asset-domain'],
          filters: { 'lane-count': 'two' },
          ranges: {},
        },
      })
    )
  })

  it('returns 500 on contract initialization failure and retries later', async () => {
    const { buildTermIndex, getInitializedStore } = await import('@ontology-search/search')
    vi.mocked(getInitializedStore).mockRejectedValueOnce(new Error('temporary load failure'))

    const failed = await request(
      JSON.stringify({ graphql: 'query { asset_domain { lane_count(values: ["two"]) } }' })
    )
    expect(failed.status).toBe(500)

    const retried = await request(
      JSON.stringify({ graphql: 'query { asset_domain { lane_count(values: ["two"]) } }' })
    )
    expect(retried.status).toBe(200)
    expect(buildTermIndex).toHaveBeenCalledOnce()
    // The successful response also initializes the independent enum-serialization cache.
    expect(getInitializedStore).toHaveBeenCalledTimes(3)
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

describe('GET /vocabulary', () => {
  // The route is a thin wire: term index in, projected VocabularyResponse
  // out. The projection's own mapping contract (enum/numeric selection,
  // datatype narrowing) is pinned in the search package's
  // to-vocabulary-response tests.
  it('serves the projection of the shared term index', async () => {
    const { buildTermIndex, getInitializedStore, toVocabularyResponse } =
      await import('@ontology-search/search')
    const index = { cards: [], byDomain: new Map(), domainCatalog: [] }
    const projected: VocabularyResponse = {
      domains: ['hdmap'],
      properties: [
        {
          name: 'roadTypes',
          label: 'Road types',
          description: '',
          domain: 'hdmap',
          type: 'enum',
          allowedValues: ['motorway', 'urban'],
        },
      ],
    }
    vi.mocked(getInitializedStore).mockResolvedValue({} as never)
    vi.mocked(buildTermIndex).mockResolvedValue(index as never)
    vi.mocked(toVocabularyResponse).mockReturnValue(projected)

    const res = await app.request('/vocabulary')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(projected)
    expect(buildTermIndex).toHaveBeenCalledOnce()
    expect(toVocabularyResponse).toHaveBeenCalledWith(index)
  })
})

describe('middleware', () => {
  it('CORS: sets Access-Control-Allow-Origin (default "*") on a cross-origin request', async () => {
    const res = await app.request('/health', { headers: { Origin: 'http://example.com' } })
    // Default config is CORS_ALLOWED_ORIGINS="*", so the middleware is wired and
    // permits any origin. (Prod misuse — "*" under NODE_ENV=production — is
    // rejected at config load, covered in config.test.ts.)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('body-limit: rejects a body larger than API_MAX_BODY_BYTES with 413', async () => {
    // Default API_MAX_BODY_BYTES is 64 KiB; this body is ~70 KB.
    const res = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'x'.repeat(70_000) }),
    })
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ code: 'BAD_REQUEST' })
  })
})
