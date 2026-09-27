/**
 * The Claude Code scene filler returns only a submission that validates
 * against `sceneSubmissionSchema` — never raw model output — and authors with
 * the authoring model, which may differ from the search model.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ run: vi.fn() }))

vi.mock('@ontology-search/core/config', () => ({
  getConfig: () => ({
    AI_PROVIDER: 'claude-code',
    AI_MODEL: 'claude-sonnet-5',
    AUTHORING_AI_MODEL: 'claude-opus-5-5',
    AUTHORING_REASONING_EFFORT: 'medium',
    LLM_THINKING: 'off',
    LLM_MAX_AGENT_STEPS: 3,
    RETRIEVAL_MAX_DOMAINS: 3,
    RETRIEVAL_MAX_CARDS: 40,
    RETRIEVAL_MAX_CONTEXT_CHARS: 45_000,
  }),
}))

vi.mock('../../claude-code-cli.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../claude-code-cli.js')>()),
  runClaudeCodeStructured: h.run,
}))

vi.mock('../scene-prompt.js', () => ({ getSceneStaticCore: () => 'SCENE STATIC CORE' }))

import { fillSceneClaudeCode, STRUCTURED_SCENE_NOTE } from '../fill-scene-claude-code.js'
import { sceneSubmissionSchema } from '../scene-tool.js'

/** Built from the schema's own parse, so the test names no scenario vocabulary. */
const validScene = sceneSubmissionSchema.safeParse({
  scene: { entities: [], actions: [] },
  interpretation: { summary: 'authored', mappedTerms: [] },
  gaps: [],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fillSceneClaudeCode', () => {
  it('returns the submission when it validates, authored with the authoring model', async () => {
    expect(validScene.success).toBe(true)
    h.run.mockResolvedValue({ structuredOutput: validScene.data, numTurns: 2, durationApiMs: 1 })

    const scene = await fillSceneClaudeCode('REQUEST MESSAGE')

    expect(scene).toEqual(validScene.data)
    const call = h.run.mock.calls[0]?.[0]
    expect(call).toMatchObject({
      model: 'claude-opus-5-5',
      systemPrompt: `SCENE STATIC CORE\n\n${STRUCTURED_SCENE_NOTE}`,
      userMessage: 'REQUEST MESSAGE',
    })
    expect(call.jsonSchema).not.toHaveProperty('$schema')
    expect(call.jsonSchema.properties).toHaveProperty('scene')
  })

  it('returns null — never raw output — when the submission does not validate', async () => {
    h.run.mockResolvedValue({
      structuredOutput: { xosc: '<OpenSCENARIO/>' },
      numTurns: 2,
      durationApiMs: 1,
    })

    await expect(fillSceneClaudeCode('REQUEST MESSAGE')).resolves.toBeNull()
  })
})
