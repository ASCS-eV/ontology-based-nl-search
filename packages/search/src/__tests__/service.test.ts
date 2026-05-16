/**
 * Tests for the unified search service.
 * Uses direct dependency injection — no vi.mock() needed.
 */
import type { SparqlResults, SparqlStore } from '@ontology-search/sparql/types'
import { vi } from 'vitest'

import type { SearchDependencies } from '../service.js'
import { SearchService } from '../service.js'
import type { LlmStructuredResponse } from '../types.js'

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
  query: vi.fn().mockResolvedValue(mockSparqlResults),
  update: vi.fn(),
  loadTurtle: vi.fn(),
  loadJsonLd: vi.fn(),
  isReady: vi.fn().mockResolvedValue(true),
} satisfies Record<keyof SparqlStore, unknown>

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
    getStore: vi.fn().mockResolvedValue(mockStore),
    interpretQuery: vi.fn().mockResolvedValue(mockLlmResponse),
    compileSlots: vi.fn().mockResolvedValue(MOCK_SPARQL),
    compileCountQueries: vi.fn().mockResolvedValue([
      {
        domain: 'hdmap',
        query: 'SELECT (COUNT(*) as ?count) WHERE { ?s a <http://example.org/HDMap> }',
      },
    ]),
    enforcePolicy: vi.fn().mockReturnValue({
      allowed: true,
      violations: [],
      query: MOCK_SPARQL,
    }),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
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
      enforcePolicy: vi.fn().mockReturnValue({
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
      enforcePolicy: vi.fn().mockReturnValue({
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
      compileSlots: vi.fn().mockRejectedValue(new Error('Unknown domain: foobar')),
    })
    const service = new SearchService(deps)

    await expect(service.searchRefine({ slots })).rejects.toThrow('Unknown domain: foobar')
  })

  /**
   * R4: When a `validateSlots` dependency is configured, `searchRefine` MUST
   * run it BEFORE compileSlots, and compileSlots MUST receive the validator's
   * output (not the raw caller input). This is the defense-in-depth gate
   * that prevents a refine caller from bypassing SHACL validation.
   */
  it('applies validateSlots before compileSlots (R4)', async () => {
    const validateSlots = vi.fn(async (s: typeof slots) => ({
      ...s,
      // Pretend the validator dropped a previously-present unknown property
      // and stripped a bad location value.
      filters: { ...s.filters }, // unchanged
      location: undefined,
    }))
    const deps = createMockDeps({ validateSlots })
    const service = new SearchService(deps)

    // Call with a "tainted" location field the validator should strip.
    const tainted = { ...slots, location: { country: 'europe' } }
    await service.searchRefine({ slots: tainted })

    expect(validateSlots).toHaveBeenCalledTimes(1)
    expect(validateSlots).toHaveBeenCalledWith(tainted)

    // compileSlots must receive the validator's RESULT, not the raw input.
    const compiled = (deps.compileSlots as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(compiled.location).toBeUndefined()
  })

  /**
   * R4 (negative path): when no `validateSlots` is configured, `searchRefine`
   * MUST forward the slots to compileSlots unchanged — the dep is optional
   * and tests / library consumers may inject their own gates.
   */
  it('forwards slots unchanged when validateSlots is not configured (R4)', async () => {
    const deps = createMockDeps() // no validateSlots
    const service = new SearchService(deps)

    await service.searchRefine({ slots })

    expect(deps.compileSlots).toHaveBeenCalledWith(slots)
  })
})
