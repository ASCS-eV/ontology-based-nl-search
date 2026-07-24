/**
 * AgentPolicy derivation tests — pins how env config maps to the policy knobs,
 * per task. `search` is deterministic slot-filling: reasoning is DISABLED
 * (`'none'`) on EVERY Copilot model (benchmarked ~74% off the round-trip for
 * `claude-sonnet-5`). `authoring` is generative composition: it reads
 * `AUTHORING_AI_MODEL` / `AUTHORING_REASONING_EFFORT` so it can run a stronger,
 * reasoning-ON model independently of search. Non-copilot providers get `null`
 * (the knob is omitted). This is the regression guard for those mappings.
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
    AUTHORING_REASONING_EFFORT: 'medium',
    ...overrides,
  }
}

describe('getAgentPolicy — search task (reasoningEffort)', () => {
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

  it('uses AI_MODEL as the search model, ignoring any authoring override', () => {
    cfg.value = config({ AI_MODEL: 'claude-sonnet-5', AUTHORING_AI_MODEL: 'claude-opus-4.8' })
    expect(getAgentPolicy('search').model).toBe('claude-sonnet-5')
  })
})

describe('getAgentPolicy — authoring task', () => {
  it('enables reasoning at AUTHORING_REASONING_EFFORT on copilot', () => {
    cfg.value = config({ AUTHORING_REASONING_EFFORT: 'high' })
    expect(getAgentPolicy('authoring').reasoningEffort).toBe('high')
  })

  it('keeps search reasoning off even when an authoring effort is configured', () => {
    cfg.value = config({ AUTHORING_REASONING_EFFORT: 'high' })
    expect(getAgentPolicy('search').reasoningEffort).toBe('none')
  })

  it('overrides the model with AUTHORING_AI_MODEL for authoring', () => {
    cfg.value = config({ AI_MODEL: 'claude-sonnet-5', AUTHORING_AI_MODEL: 'claude-opus-4.8' })
    expect(getAgentPolicy('authoring').model).toBe('claude-opus-4.8')
  })

  it('falls back to AI_MODEL when AUTHORING_AI_MODEL is unset', () => {
    cfg.value = config({ AI_MODEL: 'claude-sonnet-5' })
    expect(getAgentPolicy('authoring').model).toBe('claude-sonnet-5')
  })

  it('has null reasoning for a non-copilot provider even for authoring', () => {
    cfg.value = config({ AI_PROVIDER: 'openai', AUTHORING_REASONING_EFFORT: 'high' })
    expect(getAgentPolicy('authoring').reasoningEffort).toBeNull()
  })
})
