import { describe, expect, it } from 'vitest'

import {
  EFFORT_ORDER,
  type ModelEffortCapabilities,
  resolveReasoningEffort,
} from '../reasoning-effort.js'

/**
 * Capability sets exactly as `listModels()` reported them by the SDK-bundled
 * runtime 1.0.85 and the local CLI 1.0.98 (identical for both).
 */
const caps = (
  supportsReasoningEffort: boolean,
  ...supported: string[]
): ModelEffortCapabilities => ({
  supportsReasoningEffort,
  supported,
})
const reported: Record<string, ModelEffortCapabilities> = {
  'claude-sonnet-5': caps(true, 'low', 'medium', 'high', 'xhigh', 'max'),
  'claude-sonnet-5.5': caps(true, 'low', 'medium', 'high', 'xhigh', 'max'),
  'claude-haiku-4.5': caps(false),
  'gpt-5.4': caps(true, 'none', 'low', 'medium', 'high', 'xhigh'),
  'gpt-5.6-sol': caps(true, 'none', 'low', 'medium', 'high', 'xhigh', 'max'),
  'grok-4.6': caps(true, 'low', 'medium', 'high', 'xhigh'),
  'mai-code-1.1-flash': caps(true, 'low', 'medium', 'high'),
  'gpt-5-mini': caps(true, 'low', 'medium', 'high'),
}

describe('resolveReasoningEffort', () => {
  it('sends none only where the runtime advertises it', () => {
    expect(resolveReasoningEffort('none', reported['gpt-5.4'])).toEqual({ effort: 'none' })
    expect(resolveReasoningEffort('none', reported['gpt-5.6-sol'])).toEqual({ effort: 'none' })
  })

  it('falls back to the weakest advertised effort when none is not advertised', () => {
    // claude-sonnet-5: accepted by runtime 1.0.85, rejected locally by 1.0.91+;
    // claude-sonnet-5.5, grok-4.6, mai-code-1.1-flash, gpt-5-mini: rejected by both.
    for (const model of [
      'claude-sonnet-5',
      'claude-sonnet-5.5',
      'grok-4.6',
      'mai-code-1.1-flash',
      'gpt-5-mini',
    ]) {
      const resolved = resolveReasoningEffort('none', reported[model])
      expect(resolved.effort, model).toBe('low')
      expect(resolved.adjustment, model).toContain("'none' is not advertised")
    }
  })

  it('leaves the knob unset for a model without reasoning-effort support', () => {
    expect(resolveReasoningEffort('none', reported['claude-haiku-4.5'])).toEqual({
      effort: undefined,
    })
    const high = resolveReasoningEffort('high', reported['claude-haiku-4.5'])
    expect(high.effort).toBeUndefined()
    expect(high.adjustment).toContain('does not support')
  })

  it('does not decide from the model id: only the advertised list matters', () => {
    const sameList = caps(true, 'none', 'low')
    expect(resolveReasoningEffort('none', sameList).effort).toBe('none')
    expect(resolveReasoningEffort('none', caps(true, 'low')).effort).toBe('low')
  })

  it('forwards an advertised non-none effort unchanged', () => {
    expect(resolveReasoningEffort('medium', reported['claude-sonnet-5'])).toEqual({
      effort: 'medium',
    })
    expect(resolveReasoningEffort('max', reported['gpt-5.6-sol'])).toEqual({ effort: 'max' })
  })

  it('clamps an unadvertised higher effort to the strongest one not above it', () => {
    const resolved = resolveReasoningEffort('xhigh', reported['mai-code-1.1-flash'])
    expect(resolved.effort).toBe('high')
    expect(resolved.adjustment).toContain("'xhigh'")
    expect(resolveReasoningEffort('max', reported['grok-4.6']).effort).toBe('xhigh')
  })

  it('uses the weakest advertised effort when every advertised one is above the request', () => {
    expect(resolveReasoningEffort('low', caps(true, 'medium', 'high')).effort).toBe('medium')
  })

  it('ignores advertised values it does not know and tolerates any order', () => {
    expect(resolveReasoningEffort('none', caps(true, 'high', 'minimal', 'low')).effort).toBe('low')
    expect(resolveReasoningEffort('none', caps(true, 'minimal')).effort).toBeUndefined()
  })

  it('requests nothing when nothing is requested', () => {
    expect(resolveReasoningEffort(null, reported['gpt-5.4'])).toEqual({ effort: undefined })
    expect(resolveReasoningEffort(null, undefined)).toEqual({ effort: undefined })
  })

  describe('capabilities unknown (model not listed, or listing failed)', () => {
    it('does not send an unverifiable none', () => {
      const resolved = resolveReasoningEffort('none', undefined)
      expect(resolved.effort).toBeUndefined()
      expect(resolved.adjustment).toContain('unknown')
    })

    it('forwards any other request unchanged', () => {
      expect(resolveReasoningEffort('xhigh', undefined)).toEqual({ effort: 'xhigh' })
    })
  })

  it('never sends an effort the model does not advertise (all models x all requests)', () => {
    for (const [model, capabilities] of Object.entries(reported)) {
      for (const requested of EFFORT_ORDER) {
        const { effort } = resolveReasoningEffort(requested, capabilities)
        if (effort === undefined) continue
        expect(capabilities.supported, `${model} / ${requested} -> ${effort}`).toContain(effort)
      }
    }
  })

  it('does not mutate the capabilities it is given', () => {
    const supported = ['high', 'low']
    resolveReasoningEffort('none', { supportsReasoningEffort: true, supported })
    expect(supported).toEqual(['high', 'low'])
  })
})
