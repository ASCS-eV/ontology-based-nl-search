/**
 * Per-query prompt wiring of the Vercel adapter.
 *
 * Pins: (1) the composed retrieval prompt is what reaches the model,
 * (2) `submit_slots` stays the single forced tool, (3) the `retrieval`
 * timing stage is recorded, and (4) caller aborts during retrieval
 * propagate as aborts instead of degrading.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  config: {
    AI_PROVIDER: 'claude-cli',
    AI_MODEL: 'test-model',
    LLM_TEMPERATURE: 0,
    LLM_THINKING_BUDGET: 0,
    LLM_MAX_AGENT_STEPS: 3,
    RETRIEVAL_MAX_DOMAINS: 3,
    RETRIEVAL_MAX_CARDS: 40,
  },
  generateTextArgs: null as Record<string, unknown> | null,
}))

vi.mock('@ontology-search/core/config', () => ({
  getConfig: vi.fn(() => h.config),
}))

vi.mock('ai', () => ({
  generateText: vi.fn(async (args: Record<string, unknown>) => {
    h.generateTextArgs = args
    return {
      steps: [
        {
          toolResults: [{ toolName: 'submit_slots', output: { slots: {}, interpretation: {} } }],
        },
      ],
      finishReason: 'tool-calls',
      text: '',
    }
  }),
  stepCountIs: vi.fn().mockReturnValue(undefined),
  tool: vi.fn().mockImplementation((def) => def),
}))

vi.mock('../../provider.js', () => ({ getModel: vi.fn().mockReturnValue({}) }))

vi.mock('@ontology-search/search', () => ({
  getPrimaryDomain: vi.fn().mockResolvedValue('alpha'),
  getInitializedStore: vi.fn().mockResolvedValue({}),
  extractSchemaVocabulary: vi.fn().mockResolvedValue({ domains: [] }),
  getInstanceValues: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock('../agent-context.js', () => ({
  getAgentContext: vi.fn().mockResolvedValue({ vocabulary: { domains: [] }, store: {} }),
  buildRequestPrompt: vi.fn(),
  warmupAgentContext: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../run-slot-pipeline.js', () => ({
  runSlotPipeline: vi.fn().mockResolvedValue({
    sparql: 'SELECT ?s WHERE { ?s ?p ?o }',
    interpretation: { summary: '', mappedTerms: [] },
    gaps: [],
  }),
}))

vi.mock('../empty-fallback.js', () => ({
  buildEmptyFallbackResponse: vi.fn().mockResolvedValue({
    sparql: 'SELECT ?s WHERE { ?s ?p ?o }',
    interpretation: { summary: '', mappedTerms: [] },
    gaps: [],
  }),
}))

import { buildRequestPrompt } from '../agent-context.js'
import { runSparqlAgent } from '../index.js'

const RETRIEVED = {
  prompt: 'COMPOSED_PROMPT',
  tail: 'RETRIEVED_TAIL',
  retrieved: { domains: ['alpha'], cards: [], fragments: [], confidence: 0.8, catalog: [] },
}

beforeEach(() => {
  h.generateTextArgs = null
  vi.mocked(buildRequestPrompt).mockReset()
})

describe('runSparqlAgent — per-query prompt', () => {
  it('sends the composed prompt as the system message with budgets from the policy', async () => {
    vi.mocked(buildRequestPrompt).mockResolvedValue(RETRIEVED)

    const response = await runSparqlAgent('some query')

    expect(buildRequestPrompt).toHaveBeenCalledWith(
      'some query',
      expect.objectContaining({ maxDomains: 3, maxCards: 40 })
    )
    expect(h.generateTextArgs?.['system']).toBe('COMPOSED_PROMPT')
    // The forced-tool invariant is untouched by the prompt path.
    expect(h.generateTextArgs?.['toolChoice']).toEqual({
      type: 'tool',
      toolName: 'submit_slots',
    })
    expect(response.timings?.some((t) => t.stage === 'retrieval')).toBe(true)
  })

  it('propagates caller aborts from the retrieval stage', async () => {
    vi.mocked(buildRequestPrompt).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    await expect(runSparqlAgent('some query')).rejects.toThrow('Aborted')
    expect(h.generateTextArgs).toBeNull()
  })
})
