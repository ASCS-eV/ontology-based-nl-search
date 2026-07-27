import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resetConfig } from '@ontology-search/core/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QC_RULES } from '../qc-rules.js'
import {
  checkGeometryContinuity,
  EXTERNAL_BUNDLE_SKIP_PREFIX,
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

  // The external backend's reason for existing: run a real ASAM checker bundle
  // and import its findings, rather than reimplementing its rules here. The
  // bundle is a Python program that is not a dependency of this repo, so the
  // contract is exercised with a stub that honours it ([QC-FW]).
  describe('external backend — imported bundle findings', () => {
    const STUB = `#!/bin/sh
set -e
result=$(sed -n 's/.*name="resultFile" value="\\([^"]*\\)".*/\\1/p' "$ASAM_QC_FRAMEWORK_CONFIG_FILE")
cat > "$result" <<XQAR
<CheckerResults version="1.0.0"><CheckerBundle name="stub" version="1" description="" build_date="" summary="1">
<Checker checkerId="check_asam_xodr_road_lane_level_true_one_side" description="" summary="1">
<Issue description="level=true on one side only" issueId="0" level="1" ruleUID="asam.net:xodr:1.7.0:road.lane.level_true_one_side">
<Locations description="road 1"><FileLocation column="5" row="9" /></Locations></Issue></Checker></CheckerBundle></CheckerResults>
XQAR
`
    let dir: string
    let stub: string

    beforeAll(async () => {
      dir = await mkdtemp(join(tmpdir(), 'residual-stub-'))
      stub = join(dir, 'bundle.sh')
      await writeFile(stub, STUB, 'utf8')
      await chmod(stub, 0o755)
    })

    afterAll(async () => {
      await rm(dir, { recursive: true, force: true })
      resetConfig()
    })

    it("reports the bundle's own rule UID, not one of ours", async () => {
      process.env.RESIDUAL_EXTERNAL_COMMAND = stub
      resetConfig()
      const result = await new ExternalResidualChecker().check({
        roadNetworkXodr: CONTINUOUS_XODR,
      })
      const imported = result.gaps.filter((g) => g.ruleUid.startsWith('asam.net:'))
      expect(imported).toHaveLength(1)
      expect(imported[0]?.ruleUid).toBe('asam.net:xodr:1.7.0:road.lane.level_true_one_side')
      expect(imported[0]?.gate).toBe('residual')
      expect(result.ok).toBe(false)
      delete process.env.RESIDUAL_EXTERNAL_COMMAND
      resetConfig()
    })

    it('records a runner failure as skipped rather than as a pass', async () => {
      process.env.RESIDUAL_EXTERNAL_COMMAND = 'exit 4'
      resetConfig()
      const result = await new ExternalResidualChecker().check({
        roadNetworkXodr: CONTINUOUS_XODR,
      })
      // A continuous road plus a broken bundle must not look like "all clear".
      expect(result.gaps).toEqual([])
      expect(result.skipped?.some((s) => s.startsWith(EXTERNAL_BUNDLE_SKIP_PREFIX))).toBe(true)
      delete process.env.RESIDUAL_EXTERNAL_COMMAND
      resetConfig()
    })

    it('runs no bundle when none is configured, and says which rules it skipped', async () => {
      resetConfig()
      const result = await new ExternalResidualChecker().check({
        roadNetworkXodr: CONTINUOUS_XODR,
      })
      expect(result.gaps).toEqual([])
      expect(result.skipped).toEqual([
        QC_RULES.noCollisionAtScenarioStart.uid,
        QC_RULES.reachableTargetWithinHorizon.uid,
      ])
    })
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
