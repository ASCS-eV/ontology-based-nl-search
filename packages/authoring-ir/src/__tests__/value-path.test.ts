import { describe, expect, it } from 'vitest'

import type { AuthoringIR } from '../scene.js'
import { actionPath, entityPath, irValueAt } from '../value-path.js'

const ir: AuthoringIR = {
  roadNetwork: { logicFile: 'road.xodr' },
  parameters: { gap: '30' },
  entities: [{ ref: 'Ego', type: 'Vehicle', properties: { vehicleCategory: 'car' } }],
  actions: [
    { actor: 'Ego', kind: 'SpeedAction', properties: { speed: '25' } },
    { actor: 'Ego', kind: 'SpeedAction', properties: { speed: '30' } },
    { actor: 'Ego', kind: 'LaneChangeAction', properties: { lanes: ['-3', '-4'] } },
  ],
  stopTime: 12,
}

describe('irValueAt', () => {
  it('reads every kind of path the grammar names', () => {
    expect(irValueAt(ir, entityPath('Ego'))).toBe('Ego')
    expect(irValueAt(ir, entityPath('Ego', 'vehicleCategory'))).toBe('car')
    expect(irValueAt(ir, actionPath('Ego', 'SpeedAction'))).toBe('SpeedAction')
    expect(irValueAt(ir, 'parameters.gap')).toBe('30')
    expect(irValueAt(ir, 'roadNetwork.logicFile')).toBe('road.xodr')
    expect(irValueAt(ir, 'stopTime')).toBe('12')
  })

  it('reads the first action of a kind, and a list comma-joined', () => {
    expect(irValueAt(ir, actionPath('Ego', 'SpeedAction', 'speed'))).toBe('25')
    expect(irValueAt(ir, actionPath('Ego', 'LaneChangeAction', 'lanes'))).toBe('-3,-4')
  })

  it('is undefined for a value the scene does not carry', () => {
    expect(irValueAt(ir, entityPath('Ghost'))).toBeUndefined()
    expect(irValueAt(ir, entityPath('Ego', 'width'))).toBeUndefined()
    expect(irValueAt(ir, actionPath('Ego', 'TeleportAction', 's'))).toBeUndefined()
    expect(irValueAt(ir, 'parameters.none')).toBeUndefined()
    expect(irValueAt(ir, 'entity.Ego.vehicleCategory.extra')).toBeUndefined()
    expect(irValueAt(ir, 'scene')).toBeUndefined()
    expect(irValueAt({ ...ir, stopTime: undefined }, 'stopTime')).toBeUndefined()
  })
})
