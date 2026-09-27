/**
 * The Vercel-SDK scene filler runs the authoring policy's model.
 *
 * `AUTHORING_AI_MODEL` lets authoring run a different model than search. The
 * Copilot and Claude Code adapters read it from the policy; the Vercel-SDK
 * filler called `getModel()`, which always built `AI_MODEL`, so the override
 * was ignored on openai, anthropic, claude-cli, vibe-cli and ollama.
 */
import { MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  config: {} as Record<string, unknown>,
  requested: [] as Array<string | undefined>,
  model: undefined as unknown,
}))

vi.mock('@ontology-search/core/config', () => ({ getConfig: () => h.config }))
vi.mock('../../provider.js', () => ({
  getModel: (modelId?: string) => {
    h.requested.push(modelId)
    return h.model
  },
}))
vi.mock('../../agent/schema-tools.js', () => ({ SCHEMA_TOOL_NAMES: [] }))
vi.mock('../scene-prompt.js', () => ({ getSceneStaticCore: () => 'static core stub' }))

import { fillSceneVercel } from '../fill-scene-vercel.js'

const BASE_CONFIG = {
  AI_PROVIDER: 'claude-cli',
  AI_MODEL: 'search-model',
  LLM_THINKING: 'off',
  LLM_MAX_AGENT_STEPS: 3,
}

/** A model that submits one valid scene. */
function submittingModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: 'tool-call' as const,
          toolCallId: 'call-1',
          toolName: 'submit_scene',
          input: JSON.stringify({
            scene: { entities: [{ ref: 'Ego', type: 'Vehicle', properties: {} }], actions: [] },
            interpretation: { summary: 'ego only', mappedTerms: [] },
            gaps: [],
          }),
        },
      ],
      finishReason: { unified: 'tool-calls' as const, raw: 'tool_use' },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    }),
  })
}

beforeEach(() => {
  h.requested = []
  h.model = submittingModel()
})

describe('fillSceneVercel — model selection', () => {
  it('runs AUTHORING_AI_MODEL when it is set', async () => {
    h.config = { ...BASE_CONFIG, AUTHORING_AI_MODEL: 'authoring-model' }

    const submission = await fillSceneVercel('Author this scenario:\na cut-in')

    expect(submission?.scene.entities[0]?.ref).toBe('Ego')
    expect(h.requested).toEqual(['authoring-model'])
  })

  it('runs AI_MODEL when AUTHORING_AI_MODEL is unset', async () => {
    h.config = { ...BASE_CONFIG }

    await fillSceneVercel('Author this scenario:\na cut-in')

    expect(h.requested).toEqual(['search-model'])
  })
})
