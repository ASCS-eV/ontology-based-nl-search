/**
 * Unit coverage for the road-binding step (criterion #30): the single-source
 * guarantee that the SAME `.xodr` bytes feed the gates and the viewer, with no
 * silent substitution. Pure and fast — no engine in the loop.
 */

import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { defaultRoad } from '@ontology-search/road-catalog'
import { describe, expect, it } from 'vitest'

import { bindCatalogRoad } from '../run-scene-pipeline.js'
import { cutInIR } from './fixtures/cut-in-ir.js'

describe('bindCatalogRoad', () => {
  it('honours explicit road bytes and leaves the IR untouched', () => {
    const ir = cutInIR()
    const bound = bindCatalogRoad(ir, '<OpenDRIVE/>')
    expect(bound.roadNetworkXodr).toBe('<OpenDRIVE/>')
    expect(bound.ir).toBe(ir)
  })

  it('resolves the catalog road named by the IR logicFile', () => {
    const road = defaultRoad()
    const bound = bindCatalogRoad(cutInIR(), undefined)
    expect(bound.roadNetworkXodr).toBe(road.xodr)
    expect(bound.ir.roadNetwork?.logicFile).toBe(road.logicFile)
  })

  it('falls back to the default road and normalizes an unknown logicFile', () => {
    const road = defaultRoad()
    const ir: AuthoringIR = { ...cutInIR(), roadNetwork: { logicFile: 'nonexistent.xodr' } }
    const bound = bindCatalogRoad(ir, undefined)
    expect(bound.roadNetworkXodr).toBe(road.xodr)
    // The emitted .xosc must name the road that was actually validated.
    expect(bound.ir.roadNetwork?.logicFile).toBe(road.logicFile)
  })

  it('binds the default road when the IR declares no road network', () => {
    const road = defaultRoad()
    const bound = bindCatalogRoad({ entities: [], actions: [] }, undefined)
    expect(bound.roadNetworkXodr).toBe(road.xodr)
    expect(bound.ir.roadNetwork?.logicFile).toBe(road.logicFile)
  })
})
