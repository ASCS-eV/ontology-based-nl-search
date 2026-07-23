/**
 * Unit tests for the scene tool schema and the prompt assembly — the LLM
 * contract's security boundary and grounding, testable without a model.
 */

import { describe, expect, it } from 'vitest'

import {
  buildSceneRequest,
  getSceneStaticCore,
  renderRepairFeedback,
  resetSceneStaticCoreCache,
} from '../scene-prompt.js'
import { sceneSubmissionSchema } from '../scene-tool.js'

describe('sceneSubmissionSchema', () => {
  it('accepts a minimal valid submission', () => {
    const parsed = sceneSubmissionSchema.parse({
      scene: { entities: [{ ref: 'Ego', type: 'Vehicle', properties: {} }], actions: [] },
      interpretation: { summary: 'ego only', mappedTerms: [] },
      gaps: [],
    })
    expect(parsed.scene.entities[0]!.ref).toBe('Ego')
  })

  it('rejects a smuggled unknown key in the scene IR (strict boundary)', () => {
    expect(() =>
      sceneSubmissionSchema.parse({
        scene: { entities: [], actions: [], rawXosc: '<OpenSCENARIO/>' },
        interpretation: { summary: '', mappedTerms: [] },
        gaps: [],
      })
    ).toThrow()
  })
})

describe('scene prompt', () => {
  it('static core embeds the archetype contract and the derived SHACL', () => {
    resetSceneStaticCoreCache()
    const core = getSceneStaticCore()
    expect(core).toContain('submit_scene')
    expect(core).toContain('LaneChangeAction')
    // The derived OpenSCENARIO SHACL (task 01) is embedded for enum grounding.
    expect(core).toMatch(/sh:/)
  })

  it('buildSceneRequest keeps the user request below a delimiter', () => {
    const req = buildSceneRequest('a cut-in on the A9', { archetype: 'cut-in' })
    expect(req).toContain('cut-in')
    expect(req.indexOf('---')).toBeGreaterThanOrEqual(0)
    expect(req.indexOf('---')).toBeLessThan(req.indexOf('a cut-in on the A9'))
  })

  it('renderRepairFeedback cites the canonical rule UID for each gap', () => {
    const feedback = renderRepairFeedback({ entities: [], actions: [] }, [
      {
        term: 'dangling ref',
        reason: 'must resolve',
        ruleUid: 'asam.net:xosc:1.2.0:reference_control.resolvable_entity_references',
        gate: 'semantic',
        focusNode: 'Ghost',
      },
    ])
    expect(feedback).toContain('asam.net:xosc:1.2.0:reference_control.resolvable_entity_references')
    expect(feedback).toContain('Ghost')
  })
})
