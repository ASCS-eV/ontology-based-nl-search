import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { describe, expect, it } from 'vitest'

import { irToEngineTree, unexpressibleActions } from '../ir-to-engine.js'
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

  it('maps a LaneChangeAction to its own maneuver with its dynamics and target', () => {
    const m = irToEngineTree(cutInIR()).maneuvers?.[0]
    expect(m?.actorRef).toBe('A2')
    expect(m?.startTime).toBe(2)
    expect(m?.trigger).toBeUndefined()
    expect(m?.laneChange.dynamics).toEqual({
      dynamicsShape: 'cubic',
      dynamicsDimension: 'distance',
      value: 54.8,
    })
    expect(m?.laneChange.relativeTarget).toEqual({ entityRef: 'Ego', value: 0 })
  })

  it('builds an entity-based trigger from triggerKind, forwarding the kind opaquely', () => {
    const ir: AuthoringIR = {
      entities: [
        { ref: 'Ego', type: 'Vehicle', properties: {} },
        { ref: 'A2', type: 'Vehicle', properties: {} },
      ],
      actions: [
        {
          actor: 'A2',
          kind: 'LaneChangeAction',
          properties: {
            triggerKind: 'timeHeadwayCondition',
            triggerValue: '1.5',
            triggerRule: 'lessThan',
            triggerFreespace: 'true',
            triggerRelativeDistanceType: 'longitudinal',
          },
          references: { relativeTo: 'Ego' },
        },
      ],
    }
    const m = irToEngineTree(ir).maneuvers?.[0]
    // startTime still defaults (unused by the engine once a trigger is present,
    // but the field itself is just an ordinary numeric property).
    expect(m?.trigger).toEqual({
      kind: 'timeHeadwayCondition',
      triggeringEntityRef: 'A2',
      entityRef: 'Ego',
      rule: 'lessThan',
      value: 1.5,
      freespace: true,
      relativeDistanceType: 'longitudinal',
    })
  })

  it('falls back to references.relativeTo for the trigger entityRef when triggerEntityRef is omitted', () => {
    const ir: AuthoringIR = {
      entities: [],
      actions: [
        {
          actor: 'A2',
          kind: 'LaneChangeAction',
          properties: { triggerKind: 'relativeDistanceCondition', triggerValue: '5' },
          references: { relativeTo: 'Ego', triggerEntityRef: 'A1' },
        },
      ],
    }
    const m = irToEngineTree(ir).maneuvers?.[0]
    expect(m?.trigger?.entityRef).toBe('A1')
  })

  it('lowers multiple LaneChangeActions into independent maneuvers, preserving order and actors', () => {
    const ir: AuthoringIR = {
      entities: [
        { ref: 'Ego', type: 'Vehicle', properties: {} },
        { ref: 'A1', type: 'Vehicle', properties: {} },
        { ref: 'A2', type: 'Vehicle', properties: {} },
      ],
      actions: [
        {
          actor: 'A1',
          kind: 'LaneChangeAction',
          properties: { startTime: '1' },
          references: { relativeTo: 'Ego' },
        },
        {
          actor: 'A2',
          kind: 'LaneChangeAction',
          properties: { startTime: '3' },
          references: { relativeTo: 'Ego' },
        },
      ],
    }
    const maneuvers = irToEngineTree(ir).maneuvers
    expect(maneuvers).toHaveLength(2)
    expect(maneuvers?.map((m) => m.actorRef)).toEqual(['A1', 'A2'])
    expect(maneuvers?.map((m) => m.startTime)).toEqual([1, 3])
    // Deterministic, non-colliding default names per index.
    expect(maneuvers?.map((m) => m.groupName)).toEqual(['ManeuverGroup1', 'ManeuverGroup2'])
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
    expect(tree.maneuvers).toBeUndefined()
    expect(tree.entities).toEqual([])
  })

  it('carries the road network logic file through unchanged', () => {
    expect(irToEngineTree(cutInIR()).roadNetwork).toEqual({
      logicFile: 'german_highway_short.xodr',
    })
  })

  it('defaults stopTime to 30s when the IR carries none', () => {
    expect(irToEngineTree({ entities: [], actions: [] }).stopTime).toBe(30)
  })

  it('carries an IR-supplied stopTime through to the engine tree', () => {
    expect(irToEngineTree({ entities: [], actions: [], stopTime: 45 }).stopTime).toBe(45)
  })
})

describe('unexpressibleActions', () => {
  it('reports only unsupported action kinds — every LaneChangeAction is lowered', () => {
    const ir: AuthoringIR = {
      entities: [
        { ref: 'Ego', type: 'Vehicle', properties: {} },
        { ref: 'A1', type: 'Vehicle', properties: {} },
      ],
      actions: [
        {
          actor: 'A1',
          kind: 'LaneChangeAction',
          properties: {},
          references: { relativeTo: 'Ego' },
        },
        // A second maneuver, from the same actor — each lowers independently.
        {
          actor: 'A1',
          kind: 'LaneChangeAction',
          properties: {},
          references: { relativeTo: 'Ego' },
        },
        // An unsupported kind — dropped by the switch default.
        { actor: 'A1', kind: 'AcquirePositionAction', properties: {} },
      ],
    }
    const dropped = unexpressibleActions(ir)
    expect(dropped.map((d) => d.kind)).toEqual(['AcquirePositionAction'])
    // Both maneuvers survive the lowering — no drop gaps.
    expect(irToEngineTree(ir).maneuvers).toHaveLength(2)
  })

  it('reports nothing when every action is expressible (the cut-in archetype)', () => {
    expect(unexpressibleActions(cutInIR())).toEqual([])
  })
})
