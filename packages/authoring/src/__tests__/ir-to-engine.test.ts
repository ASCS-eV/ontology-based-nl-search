import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { describe, expect, it } from 'vitest'

import { irToEngineTree } from '../ir-to-engine.js'
import { cutInIR } from './fixtures/cut-in-ir.js'

describe('irToEngineTree', () => {
  it('is pure and deterministic — the same IR yields a deep-equal tree', () => {
    const ir = cutInIR()
    expect(irToEngineTree(ir)).toEqual(irToEngineTree(cutInIR()))
    // The mapping must not mutate its input.
    expect(ir).toEqual(cutInIR())
  })

  it('maps entities to vehicles, applying standard-car defaults for omitted fields', () => {
    const tree = irToEngineTree(cutInIR())
    expect(tree.entities?.map((e) => e.name)).toEqual(['Ego', 'A1', 'A2'])
    const ego = tree.entities?.[0]?.vehicle
    expect(ego?.name).toBe('HAF')
    expect(ego?.vehicleCategory).toBe('car')
    // Defaults fill the physical model so a minimal IR still validates.
    expect(ego?.performance?.maxSpeed).toBeGreaterThan(0)
    expect(ego?.boundingBox?.dimensions.length).toBeGreaterThan(0)
    expect(ego?.axles?.front?.maxSteering).toBeGreaterThan(0)
  })

  it('honours explicit vehicle property overrides', () => {
    const ir: AuthoringIR = {
      entities: [
        {
          ref: 'Truck',
          type: 'Vehicle',
          properties: { vehicleCategory: 'truck', width: '2.5', length: '12', maxSpeed: '25' },
        },
      ],
      actions: [],
    }
    const v = irToEngineTree(ir).entities?.[0]?.vehicle
    expect(v?.vehicleCategory).toBe('truck')
    expect(v?.boundingBox?.dimensions.width).toBe(2.5)
    expect(v?.boundingBox?.dimensions.length).toBe(12)
    expect(v?.performance?.maxSpeed).toBe(25)
  })

  it('folds SpeedAction + TeleportAction into per-entity Init privates, preserving order', () => {
    const tree = irToEngineTree(cutInIR())
    expect(tree.init?.map((p) => p.entityRef)).toEqual(['Ego', 'A1', 'A2'])
    const ego = tree.init?.find((p) => p.entityRef === 'Ego')
    expect(ego?.speed).toBeCloseTo(27.778)
    // Absolute lane teleport for the ego.
    expect(ego?.teleport?.lane).toEqual({ roadId: '37', laneId: '-3', s: 500, offset: 0.5 })
    // Relative-lane teleport for A1.
    const a1 = tree.init?.find((p) => p.entityRef === 'A1')
    expect(a1?.teleport?.relativeLane).toEqual({ entityRef: 'Ego', dLane: 0, ds: 84 })
  })

  it('maps the LaneChangeAction to the single maneuver with its dynamics and target', () => {
    const m = irToEngineTree(cutInIR()).maneuver
    expect(m?.actorRef).toBe('A2')
    expect(m?.startTime).toBe(2)
    expect(m?.laneChange.dynamics).toEqual({
      dynamicsShape: 'cubic',
      dynamicsDimension: 'distance',
      value: 54.8,
    })
    expect(m?.laneChange.relativeTarget).toEqual({ entityRef: 'Ego', value: 0 })
  })

  it('emits parameter declarations with inferred OpenSCENARIO types', () => {
    const tree = irToEngineTree({
      entities: [],
      actions: [],
      parameters: { owner: 'A2', count: '3', ratio: '0.5', enabled: 'true' },
    })
    const byName = Object.fromEntries((tree.parameters ?? []).map((p) => [p.name, p.parameterType]))
    expect(byName).toEqual({ owner: 'string', count: 'int', ratio: 'double', enabled: 'boolean' })
  })

  it('omits optional sections when the IR carries none', () => {
    const tree = irToEngineTree({ entities: [], actions: [] })
    expect(tree.parameters).toBeUndefined()
    expect(tree.roadNetwork).toBeUndefined()
    expect(tree.maneuver).toBeUndefined()
    expect(tree.entities).toEqual([])
  })

  it('carries the road network logic file through unchanged', () => {
    expect(irToEngineTree(cutInIR()).roadNetwork).toEqual({
      logicFile: 'german_highway_short.xodr',
    })
  })
})
