/**
 * Regression tests for the two ways a run used to end in the empty fallback
 * although the model was one step from a valid submission:
 *
 *   1. A `submit_slots` call whose arguments the schema rejected ended the
 *      loop — `hasToolCall` stops on the CALL — so the model never saw the
 *      validation error it could have corrected.
 *   2. Under `toolChoice: 'required'` a model that keeps exploring (Claude
 *      Haiku reliably did) spent the whole step budget on lookups.
 *
 * Unlike the boundary tests these drive the REAL `ai` tool loop with a
 * scripted model, because both failures lived in how the loop stops and what
 * it offers each step — nothing a mocked `generateText` can exercise.
 */
import { MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  PIPELINE_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from runSlotPipeline',
  FALLBACK_SPARQL: 'SELECT ?asset WHERE { ?asset ?p ?o } # from the empty fallback',
}))

vi.mock('@ontology-search/core/logging', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ontology-search/core/logging')>()),
  createComponentLogger: () => h.log,
}))

// One synthetic lookup tool, so the tests name no real schema tool and touch
// no store.
vi.mock('../schema-tools.js', async () => {
  const { z } = await import('zod')
  return {
    SCHEMA_TOOL_NAMES: ['lookup_terms'],
    SCHEMA_TOOL_DEFINITIONS: [
      {
        name: 'lookup_terms',
        description: 'Look up ontology terms',
        argsSchema: z.object({ text: z.string() }),
        handler: async () => ({ matches: [] }),
      },
    ],
  }
})

vi.mock('../agent-context.js', () => ({
  getAgentContext: vi.fn().mockResolvedValue({ vocabulary: { domains: [] }, store: {} }),
  buildRequestPrompt: vi.fn().mockResolvedValue({
    prompt: 'system prompt',
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

import type { AgentPolicy } from '../agent-policy.js'
import { runSparqlAgentWithModel } from '../index.js'

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>

const policy: AgentPolicy = {
  temperature: undefined,
  maxSteps: 3,
  thinking: null,
  reasoningEffort: null,
  forcedTool: 'submit_slots',
  lookupTools: ['lookup_terms'],
  model: 'mock-model-id',
  provider: 'openai',
  retrieval: { maxDomains: 3, maxCards: 40, maxContextChars: 45_000 },
}

const validSubmission = {
  slots: { domains: [], filters: { anyProp: 'anyValue' }, ranges: {} },
  interpretation: { summary: 'understood', mappedTerms: [] },
  gaps: [],
}

/** Arguments the slot schema rejects: `domains` must be an array. */
const rejectedSubmission = {
  slots: { domains: 'not-an-array', filters: {}, ranges: {} },
  interpretation: { summary: 'malformed', mappedTerms: [] },
  gaps: [],
}

let callCounter = 0
/** One model turn that calls `toolName` with `input`. */
function toolTurn(toolName: string, input: unknown): GenerateResult {
  callCounter += 1
  return {
    content: [
      {
        type: 'tool-call',
        toolCallId: `call-${callCounter}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: 'tool-calls', raw: 'tool_use' },
    usage: {
      inputTokens: { total: 10, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 5, text: undefined, reasoning: undefined },
    },
    warnings: [],
  }
}

function run(model: MockLanguageModelV4, runPolicy: AgentPolicy = policy) {
  return runSparqlAgentWithModel('any query', model, { domain: 'any-domain', policy: runPolicy })
}

beforeEach(() => {
  vi.clearAllMocks()
  callCounter = 0
})

describe('submit_slots recovery', () => {
  it('lets the model correct a rejected submission instead of falling back', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolTurn('submit_slots', rejectedSubmission),
        toolTurn('submit_slots', validSubmission),
      ],
    })

    const { validatedResponse, rawSubmission, trace } = await run(model)

    expect(validatedResponse.sparql).toBe(h.PIPELINE_SPARQL)
    expect(trace.missingSubmitFallback).toBe(false)
    // The raw submission is the accepted one, not the rejected attempt.
    expect(rawSubmission).toEqual(validSubmission)
    // The second turn was sent the rejection so the model could act on it.
    expect(model.doGenerateCalls).toHaveLength(2)
    const secondPrompt = JSON.stringify(model.doGenerateCalls[1]?.prompt)
    expect(secondPrompt).toContain('"toolName":"submit_slots"')
    expect(secondPrompt).toMatch(/"type":"error-(text|json)"/)
  })

  it('reserves the last step of the budget for submit_slots', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolTurn('lookup_terms', { text: 'a' }),
        toolTurn('lookup_terms', { text: 'b' }),
        toolTurn('submit_slots', validSubmission),
      ],
    })

    const { validatedResponse } = await run(model)

    expect(validatedResponse.sparql).toBe(h.PIPELINE_SPARQL)
    const offered = model.doGenerateCalls.map((call) => ({
      toolChoice: call.toolChoice,
      tools: (call.tools ?? []).map((tool) => tool.name).sort(),
    }))
    // Lookups stay available before the final step...
    expect(offered[0]).toEqual({
      toolChoice: { type: 'required' },
      tools: ['lookup_terms', 'submit_slots'],
    })
    // ...and the final step may only submit.
    expect(offered[2]).toEqual({
      toolChoice: { type: 'tool', toolName: 'submit_slots' },
      tools: ['submit_slots'],
    })
  })

  it('logs why the submission was rejected when the budget ends without an accepted one', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolTurn('submit_slots', rejectedSubmission),
        toolTurn('submit_slots', rejectedSubmission),
      ],
    })

    const { validatedResponse, trace } = await run(model, { ...policy, maxSteps: 2 })

    expect(validatedResponse.sparql).toBe(h.FALLBACK_SPARQL)
    expect(trace.missingSubmitFallback).toBe(true)
    const [message, data] = h.log.info.mock.calls.find(([msg]) => /fallback fired/.test(msg)) ?? []
    expect(message).toBeDefined()
    // The validation message is the actionable part — it must reach the log.
    expect(data.toolErrors).toHaveLength(2)
    expect(data.toolErrors[0]).toMatchObject({ toolName: 'submit_slots' })
    expect(data.toolErrors[0].error).toMatch(/domains/)
  })
})
