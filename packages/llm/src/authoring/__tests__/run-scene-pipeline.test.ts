/**
 * Acceptance for the deterministic scene pipeline — LLM-free, run
 * against the REAL WASM engine so the semantic gate, the writer-facade lowering,
 * and the engine's structural gate are all exercised end-to-end.
 *
 * Regression backstop (criterion #30): each gate has a positive (valid IR
 * passes) and a negative (a targeted defect is caught with the RIGHT rule UID)
 * assertion, so a gate silently losing its teeth fails here.
 */

import { QC_RULES } from '@ontology-search/authoring-gate'
import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { describe, expect, it } from 'vitest'

import { repairableGaps, runScenePipeline } from '../run-scene-pipeline.js'
import { cutInIR } from './fixtures/cut-in-ir.js'

describe('runScenePipeline — valid cut-in IR', () => {
  it('passes all gates and lowers to a schema-valid .xosc', async () => {
    const result = await runScenePipeline({ ir: cutInIR() })

    expect(result.valid).toBe(true)
    expect(result.xosc).toContain('OpenSCENARIO')
    expect(result.gaps).toHaveLength(0)

    const gates = new Map(result.trace.map((t) => [t.gate, t]))
    expect(gates.get('semantic')?.ok).toBe(true)
    expect(gates.get('structural')?.ok).toBe(true)
    // The IR names a catalog road (german_highway_short), so the pipeline binds
    // its real bytes and the residual geometry gate RUNS and passes on the
    // continuous highway — the same bytes the viewer will render. The
    // geometry-continuity check is no longer skipped for want of a road; only the
    // simulation-only rules stay skipped in the default analytic residual mode.
    expect(gates.get('residual')?.ok).toBe(true)
    expect(gates.get('residual')?.skipped ?? []).not.toContain(QC_RULES.geometryContinuity.uid)
  })

  it('is deterministic — the same IR yields a byte-identical document', async () => {
    const a = await runScenePipeline({ ir: cutInIR() })
    const b = await runScenePipeline({ ir: cutInIR() })
    expect(a.xosc).toBe(b.xosc)
  })
})

describe('runScenePipeline — semantic gate has teeth', () => {
  it('flags a duplicate entity name (uniqueElementNames)', async () => {
    const ir = cutInIR()
    ir.entities[1]!.ref = 'Ego' // collides with entities[0]

    const result = await runScenePipeline({ ir })

    expect(result.valid).toBe(false)
    const gap = result.gaps.find((g) => g.gate === 'semantic')
    expect(gap?.ruleUid).toBe(QC_RULES.uniqueElementNames.uid)
  })

  it('flags an unresolvable entity reference (resolvableEntityReferences)', async () => {
    const ir = cutInIR()
    const laneChange = ir.actions.find((a) => a.kind === 'LaneChangeAction')!
    laneChange.references = { relativeTo: 'Ghost' } // no such entity

    const result = await runScenePipeline({ ir })

    expect(result.valid).toBe(false)
    expect(result.gaps.some((g) => g.ruleUid === QC_RULES.resolvableEntityReferences.uid)).toBe(
      true
    )
  })
})

describe('runScenePipeline — aligns listed values before the gates', () => {
  /**
   * Regression: a listed value in another spelling went to the structural
   * gate as a schema violation, costing a repair turn for what a lookup
   * settles.
   */
  it('replaces a value by the member it is closest to and records it in the trace', async () => {
    const ir = cutInIR()
    const laneChange = ir.actions.find((a) => a.kind === 'LaneChangeAction')!
    laneChange.properties = { ...laneChange.properties, dynamicsShape: 'Cubic' }

    const result = await runScenePipeline({ ir })

    expect(result.valid).toBe(true)
    const alignment = result.trace[0]
    expect(alignment?.gate).toBe('alignment')
    expect(alignment?.corrections).toEqual([
      {
        where: `action ${laneChange.actor} LaneChangeAction`,
        property: 'dynamicsShape',
        from: 'Cubic',
        to: 'cubic',
      },
    ])
    const gated = result.ir.actions.find((a) => a.kind === 'LaneChangeAction')
    expect(gated?.properties['dynamicsShape']).toBe('cubic')
  })
})

describe('runScenePipeline — a road the catalog lacks', () => {
  /**
   * Regression: an unknown `logicFile` was replaced by the default road with
   * no trace of it, so a scene on another road than the one asked for passed
   * as valid.
   */
  it('is a semantic gap naming the road asked for and the road bound', async () => {
    const ir: AuthoringIR = { ...cutInIR(), roadNetwork: { logicFile: 'atlantis.xodr' } }

    const result = await runScenePipeline({ ir })

    expect(result.valid).toBe(false)
    const gap = result.gaps.find((g) => g.ruleUid === QC_RULES.resolvableRoadReference.uid)
    expect(gap?.gate).toBe('semantic')
    expect(gap?.term).toBe('atlantis.xodr')
    expect(gap?.reason).toContain(result.ir.roadNetwork?.logicFile)
    expect(result.trace.find((t) => t.gate === 'semantic')?.ok).toBe(false)
  })
})

describe('runScenePipeline — structural gate has teeth', () => {
  it('flags an invalid enum the engine rejects (a structural violation)', async () => {
    const ir = cutInIR()
    const laneChange = ir.actions.find((a) => a.kind === 'LaneChangeAction')!
    laneChange.properties = { ...laneChange.properties, dynamicsShape: 'bogus' }

    const result = await runScenePipeline({ ir })

    expect(result.valid).toBe(false)
    expect(result.gaps.some((g) => g.gate === 'structural')).toBe(true)
  })
})

describe('runScenePipeline — reports what the lowering cannot express', () => {
  it('flags an unsupported action kind, and is NOT valid', async () => {
    const ir = cutInIR()
    // A second LaneChangeAction — lowered to its own maneuver, scoped to its
    // own actor — and an action kind the lowering does not support at all.
    // Both reference a real entity, so the semantic gate is silent and the
    // emitted .xosc is otherwise schema-valid — only the unsupported kind is
    // a gap.
    ir.actions.push(
      {
        actor: 'A2',
        kind: 'LaneChangeAction',
        properties: {},
        references: { relativeTo: 'Ego' },
      },
      { actor: 'A2', kind: 'AcquirePositionAction', properties: {} }
    )

    const result = await runScenePipeline({ ir })

    expect(result.valid).toBe(false)
    const dropGaps = result.gaps.filter((g) => g.ruleUid === QC_RULES.unexpressibleAction.uid)
    expect(dropGaps).toHaveLength(1)
    expect(dropGaps.every((g) => g.gate === 'structural')).toBe(true)
  })
})

describe('runScenePipeline — where each value came from', () => {
  /**
   * Regression: the model's assumed values and the lowering's defaults were
   * shown as ordinary scene values, indistinguishable from what the user
   * stated.
   */
  it('keeps the assumptions that name a scene value and reports the lowering defaults', async () => {
    const ir = cutInIR()
    const result = await runScenePipeline({
      ir,
      assumptions: [
        { path: 'action.Ego.SpeedAction.speed', reason: 'no speed was given' },
        { path: 'entity.Ghost.vehicleCategory', reason: 'names no entity of the scene' },
      ],
    })

    expect(result.assumptions).toEqual([
      { path: 'action.Ego.SpeedAction.speed', reason: 'no speed was given' },
    ])
    const defaults = new Map(result.loweringDefaults.map((d) => [d.path, d.value]))
    expect(defaults.get('entity.Ego.length')).toBe('4.5')
    expect(defaults.has('action.A2.LaneChangeAction.dynamicsShape')).toBe(false)
    expect(defaults.get('stopTime')).toBe('30')
  })
})

describe('runScenePipeline — repairableGaps', () => {
  it('excludes residual road-geometry gaps (not IR-fixable)', () => {
    const gaps = [
      {
        term: 'a',
        reason: 'r',
        ruleUid: QC_RULES.resolvableEntityReferences.uid,
        gate: 'semantic' as const,
      },
      {
        term: 'b',
        reason: 'r',
        ruleUid: QC_RULES.geometryContinuity.uid,
        gate: 'residual' as const,
      },
    ]
    const fixable = repairableGaps(gaps)
    expect(fixable).toHaveLength(1)
    expect(fixable[0]!.gate).toBe('semantic')
  })
})

describe('runScenePipeline — abort', () => {
  it('rejects when the signal is already aborted', async () => {
    await expect(runScenePipeline({ ir: cutInIR(), signal: AbortSignal.abort() })).rejects.toThrow(
      /abort/i
    )
  })
})
