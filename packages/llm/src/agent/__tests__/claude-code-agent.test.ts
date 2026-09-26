/**
 * The Claude Code search adapter holds the same boundary as the other two:
 * only a submission that validates against `slotSubmissionSchema` reaches the
 * slot pipeline, anything else falls back deterministically, and provider
 * faults surface as the runner raised them. The transport itself is pinned in
 * `../../__tests__/claude-code-cli.test.ts`.
 */
import { AgentError } from '@ontology-search/core/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  run: vi.fn(),
  PIPELINE_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from runSlotPipeline',
  FALLBACK_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from the empty fallback',
}))

vi.mock('@ontology-search/core/config', () => ({
  getConfig: () => ({
    AI_PROVIDER: 'claude-code',
    AI_MODEL: 'claude-sonnet-5',
    LLM_THINKING: 'off',
    LLM_MAX_AGENT_STEPS: 3,
    RETRIEVAL_MAX_DOMAINS: 2,
    RETRIEVAL_MAX_CARDS: 30,
    RETRIEVAL_MAX_CONTEXT_CHARS: 20_000,
  }),
}))

vi.mock('../../claude-code-cli.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../claude-code-cli.js')>()),
  runClaudeCodeStructured: h.run,
}))

vi.mock('../agent-context.js', () => ({
  getAgentContext: vi.fn().mockResolvedValue({ vocabulary: { domains: [] }, store: {} }),
  buildRequestPrompt: vi.fn().mockResolvedValue({
    prompt: 'STATIC CORE + RETRIEVED SCHEMA',
    retrieved: { domains: [], cards: [], fragments: [], confidence: 1, catalog: [] },
  }),
  warmupAgentContext: vi.fn(),
}))

vi.mock('../run-slot-pipeline.js', () => ({
  runSlotPipeline: vi.fn(async ({ submission }) => ({
    slots: submission.slots,
    interpretation: submission.interpretation,
    gaps: submission.gaps,
    sparql: h.PIPELINE_SPARQL,
  })),
}))

vi.mock('../empty-fallback.js', () => ({
  buildEmptyFallbackResponse: vi.fn(async () => ({
    interpretation: { summary: 'fallback', mappedTerms: [] },
    gaps: [],
    sparql: h.FALLBACK_SPARQL,
  })),
}))

import { buildRequestPrompt } from '../agent-context.js'
import { runClaudeCodeAgent, STRUCTURED_SUBMISSION_NOTE } from '../claude-code-agent.js'
import { runSlotPipeline } from '../run-slot-pipeline.js'

const submission = {
  slots: { domains: [], filters: { anyProp: 'anyValue' }, ranges: {} },
  interpretation: { summary: 'understood', mappedTerms: [] },
  gaps: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runClaudeCodeAgent', () => {
  it('compiles only from a submission that validates, via the shared slot pipeline', async () => {
    h.run.mockResolvedValue({ structuredOutput: submission, numTurns: 2, durationApiMs: 900 })

    const response = await runClaudeCodeAgent('any query', { domain: 'any-domain' })

    expect(response.sparql).toBe(h.PIPELINE_SPARQL)
    expect(vi.mocked(runSlotPipeline)).toHaveBeenCalledWith(
      expect.objectContaining({ submission, targetDomain: 'any-domain', query: 'any query' })
    )
  })

  it('runs the policy model on the shared prompt, with the submission as structured output', async () => {
    h.run.mockResolvedValue({ structuredOutput: submission, numTurns: 2, durationApiMs: 900 })
    const signal = new AbortController().signal

    await runClaudeCodeAgent('any query', { domain: 'any-domain', signal })

    // Retrieval reads the policy's budgets, like the other adapters.
    expect(vi.mocked(buildRequestPrompt)).toHaveBeenCalledWith('any query', {
      signal,
      maxDomains: 2,
      maxCards: 30,
      maxContextChars: 20_000,
    })
    const call = h.run.mock.calls[0]?.[0]
    expect(call).toMatchObject({
      model: 'claude-sonnet-5',
      systemPrompt: `STATIC CORE + RETRIEVED SCHEMA\n\n${STRUCTURED_SUBMISSION_NOTE}`,
      userMessage: 'any query',
      signal,
    })
    // The slot schema, minus the one declaration the CLI cannot resolve.
    expect(call.jsonSchema).not.toHaveProperty('$schema')
    expect(call.jsonSchema.properties).toHaveProperty('slots')
  })

  it('falls back deterministically when the output does not validate — its text never compiles', async () => {
    h.run.mockResolvedValue({
      structuredOutput: { sparql: 'DELETE WHERE { ?s ?p ?o }' },
      numTurns: 2,
      durationApiMs: 900,
    })

    const response = await runClaudeCodeAgent('any query', { domain: 'any-domain' })

    expect(response.sparql).toBe(h.FALLBACK_SPARQL)
    expect(response.sparql).not.toContain('DELETE')
    expect(vi.mocked(runSlotPipeline)).not.toHaveBeenCalled()
  })

  it('surfaces provider faults exactly as the runner raised them', async () => {
    const fault = new AgentError('Claude Code is not signed in.')
    h.run.mockRejectedValue(fault)

    await expect(runClaudeCodeAgent('any query', { domain: 'any-domain' })).rejects.toBe(fault)
  })
})
