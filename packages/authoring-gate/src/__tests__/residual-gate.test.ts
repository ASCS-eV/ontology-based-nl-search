import { describe, expect, it } from 'vitest'

import { QC_RULES } from '../qc-rules.js'
import {
  checkGeometryContinuity,
  ExternalResidualChecker,
  getResidualChecker,
  InProcessResidualChecker,
  runResidualGate,
} from '../residual-gate.js'
import { CONTINUOUS_XODR, DISCONTINUOUS_XODR } from './fixtures/xodr.js'

describe('checkGeometryContinuity', () => {
  it('passes a continuous road (line → clothoid → arc)', () => {
    expect(checkGeometryContinuity(CONTINUOUS_XODR)).toEqual([])
  })

  it('flags a discontinuous join with the geometry.continuity UID and a G1 message', () => {
    const gaps = checkGeometryContinuity(DISCONTINUOUS_XODR)
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps.every((g) => g.ruleUid === QC_RULES.geometryContinuity.uid)).toBe(true)
    expect(gaps.some((g) => g.reason.includes('G1'))).toBe(true)
    expect(gaps.some((g) => g.reason.includes('G2'))).toBe(true)
    expect(gaps[0]?.gate).toBe('residual')
  })
})

describe('runResidualGate', () => {
  it('passes a continuous road and reports simulation-only rules as skipped', async () => {
    const result = await runResidualGate({ roadNetworkXodr: CONTINUOUS_XODR })
    expect(result.ok).toBe(true)
    expect(result.gaps).toEqual([])
    expect(result.skipped?.length).toBeGreaterThan(0)
  })

  it('fails a discontinuous road', async () => {
    const result = await runResidualGate({ roadNetworkXodr: DISCONTINUOUS_XODR })
    expect(result.ok).toBe(false)
  })

  it('passes when no road network is provided (nothing to check)', async () => {
    const result = await runResidualGate({})
    expect(result.ok).toBe(true)
    expect(result.gaps).toEqual([])
  })
})

describe('getResidualChecker', () => {
  it('defaults to the in-process analytic backend', () => {
    expect(getResidualChecker('in-process')).toBeInstanceOf(InProcessResidualChecker)
    expect(getResidualChecker('in-process').mode).toBe('in-process')
  })

  it('returns the external backend when requested', () => {
    expect(getResidualChecker('external')).toBeInstanceOf(ExternalResidualChecker)
    expect(getResidualChecker('external').mode).toBe('external')
  })

  it('external backend still runs analytic geometry and skips simulation rules', async () => {
    const result = await getResidualChecker('external').check({
      roadNetworkXodr: DISCONTINUOUS_XODR,
    })
    expect(result.ok).toBe(false)
    expect(result.skipped?.length).toBeGreaterThan(0)
  })

  it('reads RESIDUAL_MODE from config when no mode is passed', () => {
    // Default config RESIDUAL_MODE is "in-process".
    expect(getResidualChecker()).toBeInstanceOf(InProcessResidualChecker)
  })

  it('external backend passes when given no road network', async () => {
    const result = await getResidualChecker('external').check({})
    expect(result.ok).toBe(true)
    expect(result.gaps).toEqual([])
  })
})

describe('backend cancellation', () => {
  it('the in-process backend honours an already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      new InProcessResidualChecker().check(
        { roadNetworkXodr: CONTINUOUS_XODR },
        { signal: controller.signal }
      )
    ).rejects.toThrow(/abort/i)
  })

  it('the external backend honours an already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      new ExternalResidualChecker().check(
        { roadNetworkXodr: CONTINUOUS_XODR },
        { signal: controller.signal }
      )
    ).rejects.toThrow(/abort/i)
  })
})

describe('checkGeometryContinuity edge cases', () => {
  it('normalizes heading jumps larger than ±π in both directions', () => {
    // join 0→1: end(0) − 4.0 = −4 (≤ −π loop); join 1→2: end(4.0) − 0 = 4 (> π loop).
    const sharpTurn = `<OpenDRIVE>
  <road id="7">
    <planView>
      <geometry s="0" x="0" y="0" hdg="0" length="10"><line/></geometry>
      <geometry s="10" x="10" y="0" hdg="4.0" length="10"><line/></geometry>
      <geometry s="20" x="20" y="0" hdg="0" length="10"><line/></geometry>
    </planView>
  </road>
</OpenDRIVE>`
    const gaps = checkGeometryContinuity(sharpTurn)
    expect(gaps.length).toBe(2)
    expect(gaps.every((g) => g.reason.includes('G1'))).toBe(true)
  })

  it('skips a road with no planView', () => {
    expect(checkGeometryContinuity('<OpenDRIVE><road id="9"></road></OpenDRIVE>')).toEqual([])
  })

  it('tolerates a missing OpenDRIVE root and empty documents', () => {
    expect(checkGeometryContinuity('<NotOpenDrive/>')).toEqual([])
    expect(checkGeometryContinuity('<OpenDRIVE></OpenDRIVE>')).toEqual([])
  })

  it('falls back to the road index and treats non-numeric attributes as zero', () => {
    const oddball = `<OpenDRIVE>
  <road>
    <planView>
      <geometry s="0" x="0" y="0" hdg="oops" length="10"><line/></geometry>
    </planView>
  </road>
</OpenDRIVE>`
    expect(checkGeometryContinuity(oddball)).toEqual([])
  })
})
