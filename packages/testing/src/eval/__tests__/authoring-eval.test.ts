/**
 * The authoring eval harness: the scoring on fixed inputs, and the recorded
 * submissions replayed through the real gate pipeline as the CI gate.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

/**
 * The recorded cut-in with the wrong ego speed, a late lane change, and the
 * lane change relative to the cutting-in car itself.
 */
function knownWrong(): Authored {
  const right = RECORDED_SUBMISSIONS[CUT_IN.name]!.scene
  return {
    ir: {
      ...right,
      actions: right.actions.map((a) =>
        a.actor === 'Ego' && a.kind === 'SpeedAction'
          ? { ...a, properties: { speed: '30' } }
          : a.kind === 'LaneChangeAction'
            ? {
                ...a,
                properties: { ...a.properties, startTime: '5' },
                references: { relativeTo: 'CutIn' },
              }
            : a
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

  /**
   * Regression: fields were looked up by the entity refs of the recording, so
   * a live model that named the cutting-in car `A1` missed every field of it
   * on a correct scene.
   */
  it('finds each entity by its role, whatever ref the model gave it', () => {
    const right = RECORDED_SUBMISSIONS[CUT_IN.name]!.scene
    const rename = (ref: string): string => ({ Ego: 'Host', CutIn: 'A1' })[ref] ?? ref
    const renamed: Authored = {
      ...knownWrong(),
      ir: {
        ...right,
        entities: right.entities.map((e) => ({ ...e, ref: rename(e.ref) })),
        actions: right.actions.map((a) => ({
          ...a,
          actor: rename(a.actor),
          ...(a.references
            ? {
                references: Object.fromEntries(
                  Object.entries(a.references).map(([k, v]) => [k, rename(v)])
                ),
              }
            : {}),
        })),
      } as Authored['ir'],
    }
    expect(scoreCase(CUT_IN, renamed, 5).fieldAgreement).toBe(1)
  })

  it('misses the fields of a role no entity or several entities fill', () => {
    const wrong = knownWrong()
    const laneChange = wrong.ir.actions.find((a) => a.kind === 'LaneChangeAction')!
    const bothChange: Authored = {
      ...wrong,
      ir: { ...wrong.ir, actions: [...wrong.ir.actions, { ...laneChange, actor: 'Ego' }] },
    }
    const result = scoreCase(CUT_IN, bothChange, 5)
    const actual = (field: string) => result.fields.find((f) => f.field === field)?.actual
    // Both cars change lanes, so neither role picks a car.
    expect(actual('action.CutIn.SpeedAction.speed')).toBeUndefined()
    expect(actual('entity.Ego.vehicleCategory')).toBeUndefined()
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
    const invented = scoreCase({ ...CUT_IN, gaps: [] }, knownWrong(), 5).gaps
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

describe('the live runner', () => {
  /**
   * Regression: the live command started `tsx` without the root `.env.local`,
   * so "the configured provider" was the config default, not the provider
   * the API runs with.
   */
  it('reads the same .env.local as the API', () => {
    const root = fileURLToPath(new URL('../../../../../', import.meta.url))
    const scripts = (file: string): Record<string, string> =>
      (JSON.parse(readFileSync(`${root}${file}`, 'utf8')) as { scripts: Record<string, string> })
        .scripts
    const envFlag = /--env-file-if-exists=\S+\.env\.local/.exec(
      scripts('apps/api/package.json')['dev'] ?? ''
    )?.[0]
    expect(envFlag).toBeDefined()
    expect(scripts('packages/testing/package.json')['eval:authoring:live']).toContain(envFlag)
    expect(scripts('package.json')['eval:authoring:live']).toContain('run eval:authoring:live')
  })
})
