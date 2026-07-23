/**
 * Acceptance for the deterministic scene pipeline (task 05) — LLM-free, run
 * against the REAL WASM engine so the semantic gate, the writer-facade lowering,
 * and the engine's structural gate are all exercised end-to-end.
 *
 * Regression backstop (criterion #30): each gate has a positive (valid IR
 * passes) and a negative (a targeted defect is caught with the RIGHT rule UID)
 * assertion, so a gate silently losing its teeth fails here.
 */

import { QC_RULES } from '@ontology-search/authoring-gate'
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
    // No .xodr content supplied ⇒ residual is explicitly skipped, never a pass.
    expect(gates.get('residual')?.skipped).toContain(QC_RULES.geometryContinuity.uid)
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
