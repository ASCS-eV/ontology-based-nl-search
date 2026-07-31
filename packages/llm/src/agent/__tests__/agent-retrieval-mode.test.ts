/**
 * Per-query prompt wiring of the Vercel adapter.
 *
 * Pins: (1) the composed retrieval prompt is what reaches the model,
 * (2) `submit_slots` stays the single forced tool, (3) the `retrieval`
 * timing stage is recorded, and (4) caller aborts during retrieval
 * propagate as aborts instead of degrading.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  config: {
    AI_PROVIDER: 'claude-cli',
    AI_MODEL: 'test-model',
    LLM_TEMPERATURE: 0,
    LLM_THINKING: 'off',
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
  isStepCount: vi.fn().mockReturnValue(undefined),
  hasToolCall: vi.fn().mockReturnValue(undefined),
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
  it('sends the composed prompt as the instructions with budgets from the policy', async () => {
    vi.mocked(buildRequestPrompt).mockResolvedValue(RETRIEVED)

    const response = await runSparqlAgent('some query')

    expect(buildRequestPrompt).toHaveBeenCalledWith(
      'some query',
      expect.objectContaining({ maxDomains: 3, maxCards: 40 })
    )
    // `instructions`, not `system` — AI SDK 7 renamed the option and
    // deprecated the old name.
    expect(h.generateTextArgs?.['instructions']).toBe('COMPOSED_PROMPT')
    expect(h.generateTextArgs).not.toHaveProperty('system')
    // The submission invariant is untouched by the prompt path: every
    // step must be a tool call, and submit_slots is the only way out.
    expect(h.generateTextArgs?.['toolChoice']).toBe('required')
    expect(Object.keys(h.generateTextArgs?.['tools'] as object)).toContain('submit_slots')
    expect(response.timings?.some((t) => t.stage === 'retrieval')).toBe(true)
  })

  it('propagates caller aborts from the retrieval stage', async () => {
    vi.mocked(buildRequestPrompt).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    await expect(runSparqlAgent('some query')).rejects.toThrow('Aborted')
    expect(h.generateTextArgs).toBeNull()
  })
})

/**
 * Wire-level translation of `LLM_THINKING` into Anthropic provider options.
 *
 * These pin the SHAPE that reaches the provider, which is the part that fails
 * as a hard 400 rather than a degradation: `thinking.budget_tokens` was REMOVED
 * in the Claude 4.7 generation, while `adaptive` does not exist before 4.6
 * [ANTHROPIC-MSG] `/v1/messages` § Request. Emitting the wrong one for the
 * configured model rejects every request, so the two must never collapse onto a
 * single shape.
 */
describe('Vercel adapter — LLM_THINKING translation', () => {
  const THINKING = 'off' as const

  beforeEach(() => {
    vi.mocked(buildRequestPrompt).mockResolvedValue(RETRIEVED)
    h.config.LLM_THINKING = THINKING
  })

  afterEach(() => {
    // Restore the default so mode changes can't leak into sibling suites.
    h.config.LLM_THINKING = THINKING
  })

  it("emits { type: 'adaptive' } and no budget for LLM_THINKING='adaptive'", async () => {
    h.config.LLM_THINKING = 'adaptive' as unknown as typeof THINKING
    await runSparqlAgent('some query')

    const opts = h.generateTextArgs?.['providerOptions'] as
      | { anthropic?: { thinking?: Record<string, unknown> } }
      | undefined
    expect(opts?.anthropic?.thinking).toEqual({ type: 'adaptive' })
    // A budget alongside adaptive is exactly what 4.7+ rejects.
    expect(opts?.anthropic?.thinking).not.toHaveProperty('budgetTokens')
  })

  it("emits { type: 'enabled', budgetTokens } for a numeric LLM_THINKING", async () => {
    h.config.LLM_THINKING = 2048 as unknown as typeof THINKING
    await runSparqlAgent('some query')

    const opts = h.generateTextArgs?.['providerOptions'] as
      | { anthropic?: { thinking?: Record<string, unknown> } }
      | undefined
    expect(opts?.anthropic?.thinking).toEqual({ type: 'enabled', budgetTokens: 2048 })
  })
})
