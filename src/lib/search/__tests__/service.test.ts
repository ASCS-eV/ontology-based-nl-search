/**
 * Tests for the unified search service.
 * Mocks external dependencies (LLM, SPARQL store, compiler) to test orchestration logic.
 */
import { generateStructuredSearch } from '@/lib/llm'
import type { LlmStructuredResponse } from '@/lib/llm/types'
import { compileAllCountQueries, compileSlots } from '@/lib/search/compiler'
import { getInitializedStore } from '@/lib/search/init'
import { searchNl, searchRefine } from '@/lib/search/service'
import { enforceSparqlPolicy } from '@/lib/sparql/policy'
import type { SparqlResults } from '@/lib/sparql/types'

// Mock dependencies before imports
jest.mock('@/lib/llm', () => ({
  generateStructuredSearch: jest.fn(),
}))

jest.mock('@/lib/search/init', () => ({
  getInitializedStore: jest.fn(),
}))

jest.mock('@/lib/search/compiler', () => ({
  compileSlots: jest.fn(),
  compileAllCountQueries: jest.fn(),
}))

jest.mock('@/lib/sparql/policy', () => ({
  enforceSparqlPolicy: jest.fn(),
}))

const mockGenerateStructuredSearch = generateStructuredSearch as jest.MockedFunction<
  typeof generateStructuredSearch
>
const mockGetInitializedStore = getInitializedStore as jest.MockedFunction<
  typeof getInitializedStore
>
const mockCompileSlots = compileSlots as jest.MockedFunction<typeof compileSlots>
const mockCompileAllCountQueries = compileAllCountQueries as jest.MockedFunction<
  typeof compileAllCountQueries
>
const mockEnforceSparqlPolicy = enforceSparqlPolicy as jest.MockedFunction<
  typeof enforceSparqlPolicy
>

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

const mockStore = {
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

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInitializedStore.mockResolvedValue(mockStore)
  mockEnforceSparqlPolicy.mockReturnValue({
    allowed: true,
    violations: [],
    query: MOCK_SPARQL,
  })
  mockGenerateStructuredSearch.mockResolvedValue(mockLlmResponse)
  mockCompileSlots.mockResolvedValue(MOCK_SPARQL)
  mockCompileAllCountQueries.mockResolvedValue([
    {
      domain: 'hdmap',
      query: 'SELECT (COUNT(*) as ?count) WHERE { ?s a <http://example.org/HDMap> }',
    },
  ])
})

describe('searchNl', () => {
  it('executes the full NL search pipeline', async () => {
    const result = await searchNl({ query: 'HD maps in Germany' })

    expect(mockGetInitializedStore).toHaveBeenCalled()
    expect(mockGenerateStructuredSearch).toHaveBeenCalledWith('HD maps in Germany', {
      domain: undefined,
    })
    expect(mockEnforceSparqlPolicy).toHaveBeenCalledWith(MOCK_SPARQL)
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
    mockEnforceSparqlPolicy.mockReturnValue({
      allowed: false,
      violations: ['SERVICE clauses are not allowed'],
      query: MOCK_SPARQL,
    })

    const result = await searchNl({ query: 'test' })

    expect(result.execution.results).toEqual([])
    expect(result.execution.error).toContain('policy violation')
    // Store is NOT called for the main query (only for count queries)
    expect(mockStore.query).not.toHaveBeenCalledWith(MOCK_SPARQL)
  })

  it('handles SPARQL execution errors gracefully', async () => {
    mockStore.query.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await searchNl({ query: 'test' })

    expect(result.execution.results).toEqual([])
    expect(result.execution.error).toBe('Connection refused')
  })

  it('throws AbortError when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(searchNl({ query: 'test', signal: controller.signal })).rejects.toThrow('Aborted')
  })

  it('passes domain option to LLM', async () => {
    await searchNl({ query: 'scenarios', domain: 'scenario' })

    expect(mockGenerateStructuredSearch).toHaveBeenCalledWith('scenarios', { domain: 'scenario' })
  })
})

describe('searchRefine', () => {
  const slots = {
    domains: ['hdmap'] as string[],
    filters: { roadTypes: 'motorway' },
    ranges: {},
  }

  it('executes the refine pipeline without LLM', async () => {
    const result = await searchRefine({ slots })

    expect(mockCompileSlots).toHaveBeenCalledWith(slots)
    expect(mockEnforceSparqlPolicy).toHaveBeenCalledWith(MOCK_SPARQL)
    expect(mockStore.query).toHaveBeenCalledWith(MOCK_SPARQL)
    expect(mockGenerateStructuredSearch).not.toHaveBeenCalled()

    expect(result.sparql).toBe(MOCK_SPARQL)
    expect(result.execution.results).toHaveLength(1)
    expect(result.meta.matchCount).toBe(1)
  })

  it('returns policy violation error', async () => {
    mockEnforceSparqlPolicy.mockReturnValue({
      allowed: false,
      violations: ['LIMIT exceeds maximum'],
      query: MOCK_SPARQL,
    })

    const result = await searchRefine({ slots })

    expect(result.execution.error).toContain('LIMIT exceeds maximum')
    expect(result.execution.results).toEqual([])
  })

  it('handles compile errors', async () => {
    mockCompileSlots.mockRejectedValue(new Error('Unknown domain: foobar'))

    await expect(searchRefine({ slots })).rejects.toThrow('Unknown domain: foobar')
  })
})
