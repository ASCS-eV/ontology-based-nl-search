/**
 * The authoring eval harness: the scoring on fixed inputs, and the recorded
 * submissions replayed through the real gate pipeline as the CI gate.
 */
import type { SceneSubmissionParams } from '@ontology-search/llm/authoring'
import { beforeAll, describe, expect, it } from 'vitest'

import { AUTHORING_EVAL_CASES, RECORDED_SUBMISSIONS } from '../authoring-cases.js'
import {
  type Authored,
  type AuthoringCase,
  type AuthoringEvalSummary,
  evaluateAuthoring,
  replayRecorded,
  scoreCase,
} from '../authoring-eval.js'

const CUT_IN = AUTHORING_EVAL_CASES[0]!

/** The recorded cut-in with the wrong speed and no lane change. */
function knownWrong(): Authored {
  const right = RECORDED_SUBMISSIONS[CUT_IN.name]!.scene
  return {
    ir: {
      ...right,
      actions: right.actions
        .filter((a) => a.kind !== 'LaneChangeAction')
        .map((a) =>
          a.actor === 'Ego' && a.kind === 'SpeedAction' ? { ...a, properties: { speed: '30' } } : a
        ),
    } as Authored['ir'],
    valid: true,
    trace: [
      { gate: 'semantic', ok: true, gapCount: 0 },
      { gate: 'structural', ok: true, gapCount: 0 },
      { gate: 'residual', ok: true, gapCount: 0, skipped: ['repo:xosc:1.0.0:some.rule'] },
    ],
    reportedGaps: [{ term: 'weather', reason: 'Rain was asked for but cannot be expressed.' }],
    attempts: 2,
  }
}

describe('scoreCase', () => {
  it('scores a known-wrong submission with exactly the fields it misses', () => {
    const result = scoreCase(CUT_IN, knownWrong(), 5)
    const misses = result.fields.filter((f) => !f.agree).map((f) => f.field)
    expect(misses).toEqual([
      'action.Ego.SpeedAction.speed',
      'action.CutIn.LaneChangeAction.startTime',
      'action.CutIn.LaneChangeAction.references.relativeTo',
    ])
    expect(result.fields.find((f) => f.field === 'action.Ego.SpeedAction.speed')).toMatchObject({
      expected: '25',
      actual: '30',
    })
    expect(result.fieldAgreement).toBeCloseTo(4 / 7)
    expect(result.attempts).toBe(2)
  })

  it('never counts a gate that skipped rules as a pass', () => {
    const result = scoreCase(CUT_IN, knownWrong(), 5)
    expect(result.gates.map((g) => g.outcome)).toEqual(['pass', 'pass', 'skipped'])
  })

  it('tells a reported gap from a dropped one and an invented one', () => {
    const withGap: AuthoringCase = { ...CUT_IN, gaps: ['rain', 'fog'] }
    const result = scoreCase(withGap, knownWrong(), 5)
    expect(result.gaps).toEqual([
      { concept: 'rain', outcome: 'reported' },
      { concept: 'fog', outcome: 'dropped' },
    ])
    const invented = scoreCase(CUT_IN, knownWrong(), 5).gaps
    expect(invented).toEqual([{ concept: 'weather', outcome: 'invented' }])
  })

  it('reports a validity that differs from the asserted one', () => {
    const result = scoreCase({ ...CUT_IN, valid: false }, knownWrong(), 5)
    expect(result.validAsExpected).toBe(false)
  })
})

describe('recorded submissions through the real pipeline (CI gate)', () => {
  let summary: AuthoringEvalSummary

  beforeAll(async () => {
    summary = await evaluateAuthoring(replayRecorded(RECORDED_SUBMISSIONS), AUTHORING_EVAL_CASES)
    console.warn(`\nAuthoring eval (${summary.gating.cases} gating cases)\n${summary.table}\n`)
  }, 180_000)

  it('has gating cases (guards against a vacuous gate)', () => {
    expect(summary.gating.cases).toBeGreaterThan(0)
  })

  it('agrees on every field, drops no gap and ends valid where asserted', () => {
    expect(summary.gating.meanFieldAgreement).toBe(1)
    expect(summary.gating.fieldMisses).toBe(0)
    expect(summary.gating.gapsDropped).toBe(0)
    expect(summary.gating.validityMisses).toBe(0)
  })

  it('reports the residual rules the pipeline skips as skipped, apart from passes', () => {
    for (const result of summary.results) {
      const residual = result.gates.find((g) => g.gate === 'residual')
      expect(residual?.outcome).toBe('skipped')
      expect(residual?.skippedRules.length).toBeGreaterThan(0)
    }
    expect(summary.gating.gatesSkipped).toBe(summary.gating.cases)
  })

  it('fails loudly on a case without a recording', async () => {
    const author = replayRecorded({} as Record<string, SceneSubmissionParams>)
    await expect(author(CUT_IN)).rejects.toThrow('No recorded submission')
  })
})
