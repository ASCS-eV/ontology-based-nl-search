import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  generateText: vi.fn(),
}))

vi.mock('ai', () => ({
  generateText: h.generateText,
  isStepCount: vi.fn().mockReturnValue(undefined),
  hasToolCall: vi.fn().mockReturnValue(undefined),
  tool: vi.fn().mockImplementation((definition) => definition),
}))

vi.mock('@ontology-search/core/config', () => ({
  getConfig: () => ({
    AI_PROVIDER: 'ollama',
    AI_MODEL: 'unused',
    LLM_TEMPERATURE: 0,
    LLM_THINKING: 'off',
    LLM_MAX_AGENT_STEPS: 3,
    RETRIEVAL_MAX_DOMAINS: 3,
    RETRIEVAL_MAX_CARDS: 40,
  }),
}))

vi.mock('@ontology-search/search', () => ({
  getPrimaryDomain: vi.fn().mockResolvedValue('hdmap'),
  getInitializedStore: vi.fn().mockResolvedValue({}),
  extractSchemaVocabulary: vi.fn().mockResolvedValue({ domains: [] }),
}))

vi.mock('../agent-context.js', () => ({
  getAgentContext: vi.fn().mockResolvedValue({ vocabulary: { domains: [] }, store: {} }),
  buildRequestPrompt: vi.fn().mockResolvedValue({
    prompt: 'system prompt contents',
    tail: 'tail',
    retrieved: {
      domains: ['hdmap'],
      cards: [{ iri: 'urn:roadTypes' }],
      fragments: [{ turtle: 'abc' }],
      confidence: 0.9,
      catalog: [{ domain: 'hdmap', classLabels: ['HD Map'], sampleTerms: ['motorway'] }],
    },
  }),
  warmupAgentContext: vi.fn(),
}))

vi.mock('../run-slot-pipeline.js', () => ({
  runSlotPipeline: vi.fn(async ({ submission }) => ({
    slots: submission.slots,
    interpretation: submission.interpretation,
    gaps: submission.gaps,
    sparql: 'SELECT ?asset WHERE { ?asset a ?type }',
  })),
}))

vi.mock('../empty-fallback.js', () => ({
  buildEmptyFallbackResponse: vi.fn(),
}))

import { runSparqlAgentWithModel } from '../index.js'

const submission = {
  slots: { domains: ['hdmap'], filters: { roadTypes: 'motorway' }, ranges: {} },
  interpretation: { summary: 'motorway maps', mappedTerms: [] },
  gaps: [],
}

beforeEach(() => {
  h.generateText.mockReset()
})

describe('evaluation observer', () => {
  it('captures lookup to submission traces without changing validated output', async () => {
    h.generateText.mockResolvedValue({
      finishReason: 'tool-calls',
      usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
      steps: [
        {
          toolCalls: [{ toolCallId: 'lookup', toolName: 'find_terms', input: { text: 'highway' } }],
          toolResults: [
            {
              toolCallId: 'lookup',
              toolName: 'find_terms',
              output: { matches: [{ localName: 'roadTypes' }] },
            },
          ],
        },
        {
          toolCalls: [{ toolCallId: 'submit', toolName: 'submit_slots', input: submission }],
          toolResults: [{ toolCallId: 'submit', toolName: 'submit_slots', output: submission }],
        },
      ],
    })
    const observer = vi.fn()

    const result = await runSparqlAgentWithModel('highway maps', {} as never, { observer })

    expect(result.validatedResponse).toMatchObject({
      slots: submission.slots,
      sparql: 'SELECT ?asset WHERE { ?asset a ?type }',
    })
    expect(result.rawSubmission).toEqual(submission)
    expect(result.trace).toMatchObject({
      finishReason: 'tool-calls',
      promptChars: 22,
      missingSubmitFallback: false,
      retrieval: { domains: ['hdmap'], contextChars: 22 },
      usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
    })
    expect(result.trace.toolCalls.map((call) => call.toolName)).toEqual([
      'find_terms',
      'submit_slots',
    ])
    expect(observer).toHaveBeenCalledWith(result.trace)
    expect(JSON.stringify(result.trace)).not.toContain('system prompt contents')
  })
})
