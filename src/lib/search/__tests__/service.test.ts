/**
 * Tests for the unified search service.
 * Uses direct dependency injection — no jest.mock() needed.
 */
import type { LlmStructuredResponse } from '@/lib/llm/types'
import type { SearchDependencies } from '@/lib/search/service'
import { SearchService } from '@/lib/search/service'
import type { SparqlResults, SparqlStore } from '@/lib/sparql/types'

const MOCK_SPARQL = 'SELECT ?s WHERE { ?s a <http://example.org/Asset> } LIMIT 10'

const mockSparqlResults: SparqlResults = {
  head: { vars: ['s', 'name'] },
  results: {
    bindings: [
      {
        s: { type: 'uri', value: 'http://example.org/asset1' },
        name: { type: 'literal', value: 'Test Asset' },
      },
    ],
  },
}

const mockStore: jest.Mocked<SparqlStore> = {
  query: jest.fn().mockResolvedValue(mockSparqlResults),
  update: jest.fn(),
  loadTurtle: jest.fn(),
  loadJsonLd: jest.fn(),
  isReady: jest.fn().mockResolvedValue(true),
}

const mockLlmResponse: LlmStructuredResponse = {
  interpretation: {
    summary: 'Looking for HD maps in Germany',
    mappedTerms: [
      { input: 'Germany', mapped: 'DE', confidence: 'high', property: 'georeference:country' },
    ],
  },
  gaps: [],
  sparql: MOCK_SPARQL,
}

function createMockDeps(overrides?: Partial<SearchDependencies>): SearchDependencies {
  return {
    getStore: jest.fn().mockResolvedValue(mockStore),
    interpretQuery: jest.fn().mockResolvedValue(mockLlmResponse),
    compileSlots: jest.fn().mockResolvedValue(MOCK_SPARQL),
    compileCountQueries: jest.fn().mockResolvedValue([
      {
        domain: 'hdmap',
        query: 'SELECT (COUNT(*) as ?count) WHERE { ?s a <http://example.org/HDMap> }',
      },
    ]),
    enforcePolicy: jest.fn().mockReturnValue({
      allowed: true,
      violations: [],
      query: MOCK_SPARQL,
    }),
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SearchService.searchNl', () => {
  it('executes the full NL search pipeline', async () => {
    const deps = createMockDeps()
    const service = new SearchService(deps)

    const result = await service.searchNl({ query: 'HD maps in Germany' })

    expect(deps.getStore).toHaveBeenCalled()
    expect(deps.interpretQuery).toHaveBeenCalledWith('HD maps in Germany', {
      domain: undefined,
    })
    expect(deps.enforcePolicy).toHaveBeenCalledWith(MOCK_SPARQL)
    expect(mockStore.query).toHaveBeenCalledWith(MOCK_SPARQL)

    expect(result.interpretation).toEqual(mockLlmResponse.interpretation)
    expect(result.gaps).toEqual([])
    expect(result.sparql).toBe(MOCK_SPARQL)
    expect(result.execution.results).toEqual([
      { s: 'http://example.org/asset1', name: 'Test Asset' },
    ])
    expect(result.execution.error).toBeUndefined()
    expect(result.meta.matchCount).toBe(1)
    expect(result.meta.requestId).toMatch(/^req_/)
  })

  it('returns error when SPARQL policy rejects the query', async () => {
    const deps = createMockDeps({
      enforcePolicy: jest.fn().mockReturnValue({
        allowed: false,
        violations: ['SERVICE clauses are not allowed'],
        query: MOCK_SPARQL,
      }),
    })
    const service = new SearchService(deps)

    const result = await service.searchNl({ query: 'test' })

    expect(result.execution.results).toEqual([])
    expect(result.execution.error).toContain('policy violation')
    // Store is NOT called for the main query (only for count queries)
    expect(mockStore.query).not.toHaveBeenCalledWith(MOCK_SPARQL)
  })

  it('handles SPARQL execution errors gracefully', async () => {
    mockStore.query.mockRejectedValueOnce(new Error('Connection refused'))

    const deps = createMockDeps()
    const service = new SearchService(deps)

    const result = await service.searchNl({ query: 'test' })

    expect(result.execution.results).toEqual([])
    expect(result.execution.error).toBe('Connection refused')
  })

  it('throws AbortError when signal is already aborted', async () => {
    const deps = createMockDeps()
    const service = new SearchService(deps)
    const controller = new AbortController()
    controller.abort()

    await expect(service.searchNl({ query: 'test', signal: controller.signal })).rejects.toThrow(
      'Aborted'
    )
  })

  it('passes domain option to LLM', async () => {
    const deps = createMockDeps()
    const service = new SearchService(deps)

    await service.searchNl({ query: 'scenarios', domain: 'scenario' })

    expect(deps.interpretQuery).toHaveBeenCalledWith('scenarios', { domain: 'scenario' })
  })
})

describe('SearchService.searchRefine', () => {
  const slots = {
    domains: ['hdmap'] as string[],
    filters: { roadTypes: 'motorway' },
    ranges: {},
  }

  it('executes the refine pipeline without LLM', async () => {
    const deps = createMockDeps()
    const service = new SearchService(deps)

    const result = await service.searchRefine({ slots })

    expect(deps.compileSlots).toHaveBeenCalledWith(slots)
    expect(deps.enforcePolicy).toHaveBeenCalledWith(MOCK_SPARQL)
    expect(mockStore.query).toHaveBeenCalledWith(MOCK_SPARQL)
    expect(deps.interpretQuery).not.toHaveBeenCalled()

    expect(result.sparql).toBe(MOCK_SPARQL)
    expect(result.execution.results).toHaveLength(1)
    expect(result.meta.matchCount).toBe(1)
  })

  it('returns policy violation error', async () => {
    const deps = createMockDeps({
      enforcePolicy: jest.fn().mockReturnValue({
        allowed: false,
        violations: ['LIMIT exceeds maximum'],
        query: MOCK_SPARQL,
      }),
    })
    const service = new SearchService(deps)

    const result = await service.searchRefine({ slots })

    expect(result.execution.error).toContain('LIMIT exceeds maximum')
    expect(result.execution.results).toEqual([])
  })

  it('handles compile errors', async () => {
    const deps = createMockDeps({
      compileSlots: jest.fn().mockRejectedValue(new Error('Unknown domain: foobar')),
    })
    const service = new SearchService(deps)

    await expect(service.searchRefine({ slots })).rejects.toThrow('Unknown domain: foobar')
  })
})
