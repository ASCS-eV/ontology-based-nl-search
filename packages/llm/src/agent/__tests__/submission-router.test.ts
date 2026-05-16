import { describe, expect, it, vi } from 'vitest'

import { renderTokenDirective, type Submission, SubmissionRouter } from '../submission-router.js'

const VALID_INTERPRETATION = {
  summary: 'test',
  mappedTerms: [],
}

function buildParams(
  requestToken: string,
  overrides?: Partial<{ slots: Record<string, unknown>; mark: string }>
): Record<string, unknown> {
  return {
    requestToken,
    slots: overrides?.slots ?? { filters: { marker: overrides?.mark ?? requestToken } },
    interpretation: VALID_INTERPRETATION,
    gaps: [],
  }
}

describe('SubmissionRouter', () => {
  describe('routing semantics (regression for the LIFO race)', () => {
    it('routes by exact token regardless of insertion order', () => {
      const router = new SubmissionRouter()
      const cbA = vi.fn<(s: Submission) => void>()
      const cbB = vi.fn<(s: Submission) => void>()

      // Register A first, B second. The pre-fix code picked the most recent
      // entry on every tool call, so A's submission was delivered to B.
      router.register('token-A', cbA)
      router.register('token-B', cbB)

      // Deliver A's params — must go to A even though B was registered later.
      const resultA = router.route(buildParams('token-A', { mark: 'A' }))
      expect(resultA).toEqual({ ok: true })
      expect(cbA).toHaveBeenCalledOnce()
      expect(cbA.mock.calls[0]?.[0].slots).toEqual({ filters: { marker: 'A' } })
      expect(cbB).not.toHaveBeenCalled()

      // Deliver B's params — must go to B.
      const resultB = router.route(buildParams('token-B', { mark: 'B' }))
      expect(resultB).toEqual({ ok: true })
      expect(cbB).toHaveBeenCalledOnce()
      expect(cbB.mock.calls[0]?.[0].slots).toEqual({ filters: { marker: 'B' } })
      expect(cbA).toHaveBeenCalledOnce() // still only one call
    })

    it('routes by exact token in reverse delivery order too', () => {
      const router = new SubmissionRouter()
      const cbA = vi.fn<(s: Submission) => void>()
      const cbB = vi.fn<(s: Submission) => void>()
      router.register('token-A', cbA)
      router.register('token-B', cbB)

      // Deliver B first, then A. LIFO code would still pick B both times.
      router.route(buildParams('token-B', { mark: 'B' }))
      router.route(buildParams('token-A', { mark: 'A' }))

      expect(cbA).toHaveBeenCalledOnce()
      expect(cbA.mock.calls[0]?.[0].slots).toEqual({ filters: { marker: 'A' } })
      expect(cbB).toHaveBeenCalledOnce()
      expect(cbB.mock.calls[0]?.[0].slots).toEqual({ filters: { marker: 'B' } })
    })
  })

  describe('boundary validation', () => {
    it('strips requestToken from the payload delivered to the callback', () => {
      const router = new SubmissionRouter()
      const cb = vi.fn<(s: Submission) => void>()
      router.register('tok', cb)

      router.route(buildParams('tok'))

      const delivered = cb.mock.calls[0]?.[0] as Record<string, unknown>
      expect(delivered).toBeDefined()
      expect(delivered).not.toHaveProperty('requestToken')
      expect(delivered).toHaveProperty('slots')
    })

    it('rejects unknown tokens without invoking any callback', () => {
      const router = new SubmissionRouter()
      const cb = vi.fn<(s: Submission) => void>()
      router.register('known', cb)

      const result = router.route(buildParams('stranger'))

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('unknown_token')
      }
      expect(cb).not.toHaveBeenCalled()
    })

    it('rejects malformed params (missing requestToken) without invoking any callback', () => {
      const router = new SubmissionRouter()
      const cb = vi.fn<(s: Submission) => void>()
      router.register('tok', cb)

      const result = router.route({
        // requestToken missing — Zod parse fails.
        slots: { filters: {} },
        interpretation: VALID_INTERPRETATION,
        gaps: [],
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('malformed')
      }
      expect(cb).not.toHaveBeenCalled()
    })

    it('rejects non-object params without invoking any callback', () => {
      const router = new SubmissionRouter()
      const cb = vi.fn<(s: Submission) => void>()
      router.register('tok', cb)

      expect(router.route(null).ok).toBe(false)
      expect(router.route('not-an-object').ok).toBe(false)
      expect(router.route(42).ok).toBe(false)
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('registration lifecycle', () => {
    it('unregister removes the callback so a late tool call is rejected', () => {
      const router = new SubmissionRouter()
      const cb = vi.fn<(s: Submission) => void>()

      const unregister = router.register('tok', cb)
      expect(router.size()).toBe(1)

      unregister()
      expect(router.size()).toBe(0)

      const result = router.route(buildParams('tok'))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('unknown_token')
      expect(cb).not.toHaveBeenCalled()
    })

    it('refuses to register the same token twice', () => {
      const router = new SubmissionRouter()
      router.register('dupe', () => {})

      expect(() => router.register('dupe', () => {})).toThrow(/already registered/)
    })

    it('size reflects active registrations', () => {
      const router = new SubmissionRouter()
      expect(router.size()).toBe(0)

      const u1 = router.register('a', () => {})
      router.register('b', () => {})
      expect(router.size()).toBe(2)

      u1()
      expect(router.size()).toBe(1)
    })
  })
})

describe('renderTokenDirective', () => {
  it('emits a directive containing the token verbatim', () => {
    const out = renderTokenDirective('abc-123')
    expect(out).toContain('abc-123')
    expect(out).toContain('requestToken')
  })
})
