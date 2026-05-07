/**
 * Integration tests for the streaming search API route.
 * Mocks the search service (not individual deps) to test HTTP/SSE behavior.
 */
import { NextRequest } from 'next/server'

import { searchNl } from '@/lib/search/service'

import { POST } from '../search/stream/route'

jest.mock('@/lib/search/service', () => ({
  searchNl: jest.fn(),
  searchRefine: jest.fn(),
  getSearchService: jest.fn(),
  resetSearchService: jest.fn(),
  SearchService: jest.fn(),
}))

const mockSearchNl = searchNl as jest.MockedFunction<typeof searchNl>

/** Parse SSE stream into events */
async function parseSSE(response: Response): Promise<Array<{ event: string; data: unknown }>> {
  const text = await response.text()
  const events: Array<{ event: string; data: unknown }> = []

  const blocks = text.split('\n\n').filter((b) => b.trim())
  for (const block of blocks) {
    const lines = block.split('\n')
    let event = ''
    let data = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7)
      if (line.startsWith('data: ')) data = line.slice(6)
    }
    if (event && data) {
      events.push({ event, data: JSON.parse(data) })
    }
  }
  return events
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/search/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/search/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 for missing query field', async () => {
    const response = await POST(makeRequest({ notQuery: 'test' }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Missing or invalid')
  })

  it('returns 400 for non-string query', async () => {
    const response = await POST(makeRequest({ query: 123 }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Missing or invalid')
  })

  it('returns SSE stream with correct event sequence for valid query', async () => {
    mockSearchNl.mockResolvedValue({
      interpretation: { summary: 'Test query', mappedTerms: [] },
      gaps: [],
      sparql: 'SELECT ?asset ?name WHERE { ?asset a hdmap:HdMap ; rdfs:label ?name } LIMIT 10',
      execution: {
        results: [{ asset: 'http://ex.org/a1', name: 'Asset 1' }],
        sparql: 'SELECT ?asset ?name WHERE { ?asset a hdmap:HdMap ; rdfs:label ?name } LIMIT 10',
      },
      meta: {
        requestId: 'req_test',
        totalDatasets: 50,
        matchCount: 1,
        executionTimeMs: 42,
        timings: [],
      },
    })

    const response = await POST(makeRequest({ query: 'test search' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const events = await parseSSE(response)
    const eventTypes = events.map((e) => e.event)

    expect(eventTypes).toContain('status')
    expect(eventTypes).toContain('interpretation')
    expect(eventTypes).toContain('gaps')
    expect(eventTypes).toContain('sparql')
    expect(eventTypes).toContain('results')
    expect(eventTypes).toContain('meta')
    expect(eventTypes).toContain('done')
  })

  it('sends interpretation data matching search result', async () => {
    mockSearchNl.mockResolvedValue({
      interpretation: {
        summary: 'German motorways',
        mappedTerms: [
          { input: 'autobahn', mapped: 'motorway', confidence: 'high', property: 'roadTypes' },
        ],
      },
      gaps: [{ term: 'roundabout', reason: 'Not in ontology', suggestions: ['intersection'] }],
      sparql: 'SELECT ?a WHERE { ?a a hdmap:HdMap } LIMIT 10',
      execution: { results: [], sparql: 'SELECT ?a WHERE { ?a a hdmap:HdMap } LIMIT 10' },
      meta: {
        requestId: 'req_test2',
        totalDatasets: 0,
        matchCount: 0,
        executionTimeMs: 10,
        timings: [],
      },
    })

    const response = await POST(makeRequest({ query: 'German autobahn with roundabout' }))
    const events = await parseSSE(response)

    const interpretation = events.find((e) => e.event === 'interpretation')
    expect(interpretation?.data).toEqual({
      summary: 'German motorways',
      mappedTerms: [
        { input: 'autobahn', mapped: 'motorway', confidence: 'high', property: 'roadTypes' },
      ],
    })

    const gaps = events.find((e) => e.event === 'gaps')
    expect(gaps?.data).toEqual([
      { term: 'roundabout', reason: 'Not in ontology', suggestions: ['intersection'] },
    ])
  })

  it('includes error in results event when execution has error', async () => {
    mockSearchNl.mockResolvedValue({
      interpretation: { summary: 'Test', mappedTerms: [] },
      gaps: [],
      sparql: 'DELETE WHERE { ?s ?p ?o }',
      execution: {
        results: [],
        sparql: 'DELETE WHERE { ?s ?p ?o }',
        error: 'Query policy violation: Only SELECT queries are allowed',
      },
      meta: {
        requestId: 'req_test3',
        totalDatasets: 0,
        matchCount: 0,
        executionTimeMs: 1,
        timings: [],
      },
    })

    const response = await POST(makeRequest({ query: 'delete everything' }))
    const events = await parseSSE(response)

    const results = events.find((e) => e.event === 'results')
    expect((results?.data as { error: string }).error).toContain('policy violation')
  })

  it('sends error event when search service throws', async () => {
    mockSearchNl.mockRejectedValue(new Error('LLM API timeout'))

    const response = await POST(makeRequest({ query: 'any query' }))
    const events = await parseSSE(response)

    const errorEvent = events.find((e) => e.event === 'error')
    expect(errorEvent).toBeDefined()
    expect((errorEvent?.data as { message: string }).message).toContain('LLM API timeout')
  })

  it('includes meta with execution time and match count', async () => {
    mockSearchNl.mockResolvedValue({
      interpretation: { summary: 'Test', mappedTerms: [] },
      gaps: [],
      sparql: 'SELECT ?asset WHERE { ?asset a hdmap:HdMap } LIMIT 100',
      execution: {
        results: [
          { asset: 'http://ex.org/a1', name: 'A' },
          { asset: 'http://ex.org/a2', name: 'B' },
        ],
        sparql: 'SELECT ?asset WHERE { ?asset a hdmap:HdMap } LIMIT 100',
      },
      meta: {
        requestId: 'req_test4',
        totalDatasets: 100,
        matchCount: 2,
        executionTimeMs: 55,
        timings: [{ stage: 'sparql-execution', durationMs: 30 }],
      },
    })

    const response = await POST(makeRequest({ query: 'all maps' }))
    const events = await parseSSE(response)

    const meta = events.find((e) => e.event === 'meta')
    const metaData = meta?.data as {
      totalDatasets: number
      matchCount: number
      executionTimeMs: number
    }
    expect(metaData.totalDatasets).toBe(100)
    expect(metaData.matchCount).toBe(2)
    expect(metaData.executionTimeMs).toBeGreaterThanOrEqual(0)
  })
})
