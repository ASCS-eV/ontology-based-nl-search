import { describe, expect, it, vi } from 'vitest'

import { app } from '../app.js'

vi.mock('@ontology-search/search', () => ({
  searchNl: vi.fn(),
  searchRefine: vi.fn(),
  getInitializedStore: vi.fn(),
  compileCountQuery: vi.fn(),
  getAssetDomains: vi.fn().mockResolvedValue(new Set(['hdmap', 'scenario'])),
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
    const { searchNl } = await import('@ontology-search/search')
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
    const { searchRefine } = await import('@ontology-search/search')
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
