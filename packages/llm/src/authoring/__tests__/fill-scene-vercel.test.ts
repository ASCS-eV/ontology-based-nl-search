/**
 * `fillSceneVercel` against the real AI SDK tool loop and a scripted mock
 * model, so the stop condition runs end to end.
 *
 * Pins the observed failure: the model called `submit_scene` with only the
 * `scene` and omitted the required `interpretation` and `gaps`. Stopping on
 * that call returned no scene, which the orchestrator reported as "the model
 * did not submit a scene". The rejected input must instead go back to the
 * model as a tool error and be corrected within the step budget.
 */

import { MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ model: undefined as unknown }))

vi.mock('../../provider.js', () => ({ getModel: () => h.model }))
vi.mock('../../agent/agent-policy.js', () => ({
  getAgentPolicy: () => ({ maxSteps: 3, thinking: null, temperature: undefined }),
}))
vi.mock('../scene-prompt.js', () => ({ getSceneStaticCore: () => 'static core stub' }))

import { fillSceneVercel } from '../fill-scene-vercel.js'
import { sceneSubmissionSchema } from '../scene-tool.js'

const VALID = {
  scene: { entities: [{ ref: 'Ego', type: 'Vehicle', properties: {} }], actions: [] },
  interpretation: { summary: 'ego only', mappedTerms: [] },
  gaps: [],
}
const SCENE_ONLY = { scene: VALID.scene }

/** A model that answers each generate call with the next scripted `submit_scene` input. */
function scriptedModel(inputs: readonly unknown[]): MockLanguageModelV4 {
  let call = 0
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const input = inputs[Math.min(call, inputs.length - 1)]
      call++
      return {
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `call-${call}`,
            toolName: 'submit_scene',
            input: JSON.stringify(input),
          },
        ],
        finishReason: { unified: 'tool-calls' as const, raw: 'tool_use' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      }
    },
  })
}

beforeEach(() => {
  h.model = undefined
})

describe('fillSceneVercel — invalid submit_scene input', () => {
  it('uses fixtures that match the observed failure', () => {
    expect(sceneSubmissionSchema.safeParse(VALID).success).toBe(true)
    expect(sceneSubmissionSchema.safeParse(SCENE_ONLY).success).toBe(false)
  })

  it('returns the corrected scene when the first submission fails the schema', async () => {
    const model = scriptedModel([SCENE_ONLY, VALID])
    h.model = model

    const submission = await fillSceneVercel('Author this scenario:\na cut-in')

    expect(submission?.scene.entities[0]?.ref).toBe('Ego')
    expect(submission?.interpretation.summary).toBe('ego only')
    expect(model.doGenerateCalls).toHaveLength(2)
    // The second turn carries the validation error of the first call.
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain(
      'Invalid input for tool submit_scene'
    )
  })

  it('stops after the first valid submission', async () => {
    const model = scriptedModel([VALID])
    h.model = model

    const submission = await fillSceneVercel('Author this scenario:\na cut-in')

    expect(submission?.scene.entities).toHaveLength(1)
    expect(model.doGenerateCalls).toHaveLength(1)
  })

  it('returns null once the step budget is spent without a valid submission', async () => {
    const model = scriptedModel([SCENE_ONLY])
    h.model = model

    expect(await fillSceneVercel('Author this scenario:\na cut-in')).toBeNull()
    expect(model.doGenerateCalls).toHaveLength(3)
  })
})
