/**
 * AgentPolicy derivation tests — pins how env config maps to the policy knobs.
 *
 * Focused on `reasoningEffort`: slot-filling is deterministic (validated by the
 * SHACL gate downstream), so reasoning is DISABLED (`'none'`) on EVERY Copilot
 * model — a latency win (benchmarked ~74% off the round-trip for `claude-sonnet-5`).
 * Passing `'none'` is harmless for models that ignore the knob, so there is no
 * allowlist. Non-copilot providers get `null` (the knob is omitted). This test is
 * the regression guard for that mapping.
 */
import { describe, expect, it, vi } from 'vitest'

const cfg = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))

vi.mock('@ontology-search/core/config', () => ({
  getConfig: vi.fn(() => cfg.value),
}))

import { getAgentPolicy } from '../agent-policy.js'

function config(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    AI_PROVIDER: 'copilot',
    AI_MODEL: 'claude-sonnet-4.6',
    LLM_TEMPERATURE: 0,
    LLM_THINKING_BUDGET: 0,
    LLM_MAX_AGENT_STEPS: 3,
    ...overrides,
  }
}

describe('getAgentPolicy — reasoningEffort', () => {
  it("disables reasoning ('none') for a reasoning-capable copilot model (4.6)", () => {
    cfg.value = config({ AI_MODEL: 'claude-sonnet-4.6' })
    expect(getAgentPolicy().reasoningEffort).toBe('none')
  })

  it("disables reasoning ('none') for opus models", () => {
    cfg.value = config({ AI_MODEL: 'claude-opus-4' })
    expect(getAgentPolicy().reasoningEffort).toBe('none')
  })

  it("disables reasoning ('none') for the configured default model (claude-sonnet-5)", () => {
    // Regression: the previous allowlist gate (`includes('4.6') || 'opus'`)
    // left reasoning ON for sonnet-5, adding ~14s mean latency per query.
    cfg.value = config({ AI_MODEL: 'claude-sonnet-5' })
    expect(getAgentPolicy().reasoningEffort).toBe('none')
  })

  it("disables reasoning ('none') on copilot regardless of model (haiku)", () => {
    cfg.value = config({ AI_MODEL: 'claude-haiku-4.5' })
    expect(getAgentPolicy().reasoningEffort).toBe('none')
  })

  it('is null for non-copilot providers even on a 4.6 model', () => {
    cfg.value = config({ AI_PROVIDER: 'openai', AI_MODEL: 'claude-sonnet-4.6' })
    expect(getAgentPolicy().reasoningEffort).toBeNull()
  })
})
