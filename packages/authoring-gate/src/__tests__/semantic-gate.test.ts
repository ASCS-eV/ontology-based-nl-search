import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { beforeEach, describe, expect, it } from 'vitest'

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
