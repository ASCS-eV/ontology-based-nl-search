import { describe, expect, it, vi } from 'vitest'

vi.mock('@github/copilot-sdk', () => ({ CopilotClient: class {}, approveAll: () => ({}) }))

import { shouldForwardReasoningEffort } from '../copilot-agent.js'

describe('shouldForwardReasoningEffort', () => {
  it('omits "none" for Claude 5.x models (disabled thinking is a 400)', () => {
    expect(shouldForwardReasoningEffort('claude-sonnet-5.5', 'none')).toBe(false)
    expect(shouldForwardReasoningEffort('claude-sonnet-5', 'none')).toBe(false)
  })
  it('forwards "none" for other models', () => {
    expect(shouldForwardReasoningEffort('claude-sonnet-4.6', 'none')).toBe(true)
    expect(shouldForwardReasoningEffort('gpt-5.4', 'none')).toBe(true)
  })
  it('forwards real efforts and skips null', () => {
    expect(shouldForwardReasoningEffort('claude-sonnet-5.5', 'high')).toBe(true)
    expect(shouldForwardReasoningEffort('claude-sonnet-5.5', null)).toBe(false)
  })
})
