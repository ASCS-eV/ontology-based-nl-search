import { describe, expect, it } from 'vitest'

import { createEmptyScene } from '../scene.js'
import {
  authoringIrWireSchema,
  sceneActionWireSchema,
  sceneEntityWireSchema,
} from '../scene-wire-schema.js'

describe('authoringIrWireSchema', () => {
  const cutIn = {
    roadNetwork: { logicFile: 'SampleDatabase.xodr' },
    parameters: { owner: 'A1' },
    entities: [
      { ref: 'Ego', type: 'Vehicle', properties: { name: 'Ego', category: 'car' } },
      { ref: 'A1', type: 'Vehicle', properties: { name: 'A1' } },
    ],
    actions: [
      {
        actor: 'A1',
        kind: 'LaneChangeAction',
        properties: { targetLaneOffset: '0' },
        references: { entityRef: '$owner' },
      },
    ],
    archetype: 'cut-in',
  }

  it('accepts a well-formed cut-in IR (including $param indirection)', () => {
    const parsed = authoringIrWireSchema.parse(cutIn)
    expect(parsed.entities).toHaveLength(2)
    expect(parsed.actions[0]?.references?.entityRef).toBe('$owner')
    expect(parsed.roadNetwork?.logicFile).toBe('SampleDatabase.xodr')
  })

  it('applies defaults for omitted entities/actions/properties', () => {
    const parsed = authoringIrWireSchema.parse({})
    expect(parsed.entities).toEqual([])
    expect(parsed.actions).toEqual([])
    const e = sceneEntityWireSchema.parse({ ref: 'x', type: 'Vehicle' })
    expect(e.properties).toEqual({})
  })

  it('rejects unknown top-level keys (strict boundary — no raw XML smuggling)', () => {
    expect(() => authoringIrWireSchema.parse({ ...cutIn, rawXml: '<OpenSCENARIO/>' })).toThrow()
  })

  it('rejects an entity missing its ref', () => {
    expect(() => sceneEntityWireSchema.parse({ type: 'Vehicle' })).toThrow()
  })

  it('rejects an action missing its actor', () => {
    expect(() => sceneActionWireSchema.parse({ kind: 'LaneChangeAction' })).toThrow()
  })

  it('accepts array-valued (IN-style) properties', () => {
    const e = sceneEntityWireSchema.parse({
      ref: 'r',
      type: 'Vehicle',
      properties: { role: ['a', 'b'] },
    })
    expect(e.properties.role).toEqual(['a', 'b'])
  })
})

describe('createEmptyScene', () => {
  it('returns empty entity/action arrays', () => {
    expect(createEmptyScene()).toEqual({ entities: [], actions: [] })
  })

  it('tags the archetype when provided', () => {
    expect(createEmptyScene('cut-in').archetype).toBe('cut-in')
  })
})
