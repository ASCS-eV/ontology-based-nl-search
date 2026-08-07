import type { AuthoringIR } from '@ontology-search/authoring-ir'
import * as catalog from '@ontology-search/ontology/catalog'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetOpenDriveRoadGroundingCache } from '../opendrive-ontology.js'
import { QC_RULES } from '../qc-rules.js'
import { runSemanticGate } from '../semantic-gate.js'
import { cutInIR } from './fixtures/cut-in-ir.js'
import { CONTINUOUS_XODR, NO_ROAD_ONE_XODR } from './fixtures/xodr.js'

describe('runSemanticGate', () => {
  let ir: AuthoringIR
  beforeEach(() => {
    ir = cutInIR()
  })

  it('passes a valid cut-in with zero gaps', async () => {
    const result = await runSemanticGate(ir)
    expect(result.ok).toBe(true)
    expect(result.gaps).toEqual([])
  })

  it('resolves the cross-file road reference against a road network that contains it', async () => {
    const result = await runSemanticGate(ir, { roadNetworkXodr: CONTINUOUS_XODR })
    expect(result.ok).toBe(true)
    expect(result.gaps).toEqual([])
  })

  it('flags an unresolvable entity reference with the reference_control UID', async () => {
    ir.actions[3]!.references!.relativeTo = 'Ghost'
    const result = await runSemanticGate(ir)
    expect(result.ok).toBe(false)
    const gap = result.gaps.find((g) => g.focusNode === 'Ghost')
    expect(gap?.ruleUid).toBe(QC_RULES.resolvableEntityReferences.uid)
    expect(gap?.gate).toBe('semantic')
  })

  it('flags a dangling $param reference after resolving the parameter indirection', async () => {
    ir.parameters = { owner: 'Ghost' }
    const result = await runSemanticGate(ir)
    expect(result.ok).toBe(false)
    const gap = result.gaps.find((g) => g.focusNode === '$owner')
    expect(gap?.ruleUid).toBe(QC_RULES.resolvableEntityReferences.uid)
  })

  /**
   * The gate resolves references graph-to-graph: both the entity name and the
   * reference value reach the store through `irToRdf`, so whatever the literal
   * escaper does must be symmetric across the two. A single quote is the case
   * that changed — it is now emitted as the `\'` ECHAR rather than raw — and a
   * regression here would look like a valid scene suddenly reporting a
   * dangling reference.
   */
  it('resolves a reference whose entity name needs literal escaping', async () => {
    ir.entities[0]!.ref = `O'Brien "the\\ Ego"\ttab`
    ir.actions[3]!.references!.relativeTo = `O'Brien "the\\ Ego"\ttab`
    ir.actions[0]!.actor = `O'Brien "the\\ Ego"\ttab`
    ir.actions[1]!.actor = `O'Brien "the\\ Ego"\ttab`
    const result = await runSemanticGate(ir)
    expect(result.gaps).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('flags a duplicate entity name with the unique_element_names UID', async () => {
    ir.entities.push({ ref: 'Ego', type: 'Vehicle', properties: { name: 'dup' } })
    const result = await runSemanticGate(ir)
    expect(result.ok).toBe(false)
    const gap = result.gaps.find((g) => g.ruleUid === QC_RULES.uniqueElementNames.uid)
    expect(gap?.focusNode).toBe('Ego')
  })

  it('flags a cross-file road reference absent from the road network', async () => {
    const result = await runSemanticGate(ir, { roadNetworkXodr: NO_ROAD_ONE_XODR })
    expect(result.ok).toBe(false)
    const gap = result.gaps.find((g) => g.ruleUid === QC_RULES.resolvableRoadReference.uid)
    expect(gap?.focusNode).toBe('1')
  })

  it('does not run the cross-file check when no road network is provided', async () => {
    ir.actions[1]!.properties.roadId = '999'
    const result = await runSemanticGate(ir)
    expect(result.gaps.some((g) => g.ruleUid === QC_RULES.resolvableRoadReference.uid)).toBe(false)
  })
})

/**
 * A pinned cache that cannot be resolved is a deployment fault, not a request
 * fault — the sentinel catches it at setup and warmup at startup. If one still
 * reaches a request, `runScenePipeline` documents that it rejects only on
 * client abort, so the gate must contain it: report the rule as un-evaluated,
 * never throw, and never let an un-run check read as a pass.
 */
describe('runSemanticGate when the OpenDRIVE grounding cannot be resolved', () => {
  beforeEach(() => resetOpenDriveRoadGroundingCache())
  afterEach(() => {
    vi.restoreAllMocks()
    resetOpenDriveRoadGroundingCache()
  })

  it('records the cross-file rule as skipped instead of throwing', async () => {
    vi.spyOn(catalog, 'resolveOntologyPath').mockImplementation(() => {
      throw new Error('ontology cache is not materialized')
    })

    const result = await runSemanticGate(cutInIR(), { roadNetworkXodr: NO_ROAD_ONE_XODR })

    expect(result.skipped).toContain(QC_RULES.resolvableRoadReference.uid)
    // The other semantic checks still ran, and the un-evaluated one produced
    // no gap that could be mistaken for a verdict either way.
    expect(result.gaps.some((g) => g.ruleUid === QC_RULES.resolvableRoadReference.uid)).toBe(false)
  })

  it('reports no skipped rule when the grounding resolves', async () => {
    const result = await runSemanticGate(cutInIR(), { roadNetworkXodr: CONTINUOUS_XODR })
    expect(result.skipped).toBeUndefined()
  })
})
