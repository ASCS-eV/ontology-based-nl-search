/**
 * Integration tests for the streaming search API route.
 * Mocks the LLM layer and uses real stream parsing to verify SSE format.
 */
import { NextRequest } from 'next/server'

import { generateStructuredSearch } from '@/lib/llm'
import { getInitializedStore } from '@/lib/search/init'

import { POST } from '../search/stream/route'

// Mock the LLM module
jest.mock('@/lib/llm', () => ({
  generateStructuredSearch: jest.fn(),
}))

// Mock the store init
jest.mock('@/lib/search/init', () => ({
  getInitializedStore: jest.fn(),
}))

const mockGenerateStructuredSearch = generateStructuredSearch as jest.MockedFunction<
  typeof generateStructuredSearch
>
const mockGetInitializedStore = getInitializedStore as jest.MockedFunction<
  typeof getInitializedStore
>

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
    const mockStore = {
      query: jest.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              asset: { type: 'uri', value: 'http://ex.org/a1' },
              name: { type: 'literal', value: 'Asset 1' },
            },
          ],
        },
      }),
      update: jest.fn(),
      loadTurtle: jest.fn(),
      loadJsonLd: jest.fn(),
      isReady: jest.fn().mockResolvedValue(true),
    }

    mockGetInitializedStore.mockResolvedValue(mockStore)
    mockGenerateStructuredSearch.mockResolvedValue({
      interpretation: { summary: 'Test query', mappedTerms: [] },
      gaps: [],
      sparql: 'SELECT ?asset ?name WHERE { ?asset a hdmap:HdMap ; rdfs:label ?name } LIMIT 10',
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

  it('sends interpretation data matching LLM response', async () => {
    const mockStore = {
      query: jest.fn().mockResolvedValue({ results: { bindings: [] } }),
      update: jest.fn(),
      loadTurtle: jest.fn(),
      loadJsonLd: jest.fn(),
      isReady: jest.fn().mockResolvedValue(true),
    }

    mockGetInitializedStore.mockResolvedValue(mockStore)
    mockGenerateStructuredSearch.mockResolvedValue({
      interpretation: {
        summary: 'German motorways',
        mappedTerms: [
          { input: 'autobahn', mapped: 'motorway', confidence: 'high', property: 'roadTypes' },
        ],
      },
      gaps: [{ term: 'roundabout', reason: 'Not in ontology', suggestions: ['intersection'] }],
      sparql: 'SELECT ?a WHERE { ?a a hdmap:HdMap } LIMIT 10',
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

  it('includes error in results event on SPARQL policy violation', async () => {
    const mockStore = {
      query: jest.fn(),
      update: jest.fn(),
      loadTurtle: jest.fn(),
      loadJsonLd: jest.fn(),
      isReady: jest.fn().mockResolvedValue(true),
    }

    mockGetInitializedStore.mockResolvedValue(mockStore)
    mockGenerateStructuredSearch.mockResolvedValue({
      interpretation: { summary: 'Test', mappedTerms: [] },
      gaps: [],
      sparql: 'DELETE WHERE { ?s ?p ?o }',
    })

    const response = await POST(makeRequest({ query: 'delete everything' }))
    const events = await parseSSE(response)

    const results = events.find((e) => e.event === 'results')
    expect((results?.data as { error: string }).error).toContain('policy violation')
    // Store is still called for count query (meta), but NOT for the malicious query
    expect(mockStore.query).not.toHaveBeenCalledWith('DELETE WHERE { ?s ?p ?o }')
  })

  it('sends error event when LLM throws', async () => {
    const mockStore = {
      query: jest.fn(),
      update: jest.fn(),
      loadTurtle: jest.fn(),
      loadJsonLd: jest.fn(),
      isReady: jest.fn().mockResolvedValue(true),
    }

    mockGetInitializedStore.mockResolvedValue(mockStore)
    mockGenerateStructuredSearch.mockRejectedValue(new Error('LLM API timeout'))

    const response = await POST(makeRequest({ query: 'any query' }))
    const events = await parseSSE(response)

    const errorEvent = events.find((e) => e.event === 'error')
    expect(errorEvent).toBeDefined()
    expect((errorEvent?.data as { message: string }).message).toContain('LLM API timeout')
  })

  it('includes meta with execution time and match count', async () => {
    const mockStore = {
      query: jest.fn().mockImplementation((sparql: string) => {
        if (sparql.includes('COUNT')) {
          return Promise.resolve({
            results: { bindings: [{ count: { type: 'literal', value: '100' } }] },
          })
        }
        return Promise.resolve({
          results: {
            bindings: [
              {
                asset: { type: 'uri', value: 'http://ex.org/a1' },
                name: { type: 'literal', value: 'A' },
              },
              {
                asset: { type: 'uri', value: 'http://ex.org/a2' },
                name: { type: 'literal', value: 'B' },
              },
            ],
          },
        })
      }),
      update: jest.fn(),
      loadTurtle: jest.fn(),
      loadJsonLd: jest.fn(),
      isReady: jest.fn().mockResolvedValue(true),
    }

    mockGetInitializedStore.mockResolvedValue(mockStore)
    mockGenerateStructuredSearch.mockResolvedValue({
      interpretation: { summary: 'Test', mappedTerms: [] },
      gaps: [],
      sparql:
        'PREFIX hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nSELECT ?asset ?name WHERE { ?asset a hdmap:HdMap ; rdfs:label ?name } LIMIT 100',
    })

    const response = await POST(makeRequest({ query: 'all maps' }))
    const events = await parseSSE(response)

    const meta = events.find((e) => e.event === 'meta')
    const metaData = meta?.data as {
      totalDatasets: number
      matchCount: number
      executionTimeMs: number
    }
    expect(metaData.totalDatasets).toBeGreaterThan(0)
    expect(metaData.matchCount).toBe(2)
    expect(metaData.executionTimeMs).toBeGreaterThanOrEqual(0)
  })
})
