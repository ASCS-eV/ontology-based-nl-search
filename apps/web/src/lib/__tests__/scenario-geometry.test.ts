import { describe, expect, it } from 'vitest'

import {
  boundsOf,
  headingToThreeRotationY,
  objectsCentroidThree,
  roadThreePoints,
  worldToThree,
} from '../scenario-geometry'

describe('scenario-geometry', () => {
  describe('worldToThree', () => {
    it('maps world (x east, y north, z up) to three (x east, y up, -z north)', () => {
      expect(worldToThree(3, 5, 7)).toEqual({ x: 3, y: 7, z: -5 })
    })

    it('keeps the origin fixed', () => {
      const o = worldToThree(0, 0, 0)
      expect(o.x).toBe(0)
      expect(o.y).toBe(0)
      expect(Math.abs(o.z)).toBe(0)
    })
  })

  describe('headingToThreeRotationY', () => {
    it('is the identity (world heading == three Y-rotation)', () => {
      expect(headingToThreeRotationY(1.23)).toBe(1.23)
    })
  })

  describe('boundsOf', () => {
    it('returns a zero box centred at the origin for empty input', () => {
      expect(boundsOf([])).toEqual({
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 },
      })
    })

    it('computes min/max/center/size over several points', () => {
      const b = boundsOf([
        { x: -2, y: 0, z: 4 },
        { x: 6, y: -3, z: 10 },
      ])
      expect(b.min).toEqual({ x: -2, y: -3, z: 4 })
      expect(b.max).toEqual({ x: 6, y: 0, z: 10 })
      expect(b.center).toEqual({ x: 2, y: -1.5, z: 7 })
      expect(b.size).toEqual({ x: 8, y: 3, z: 6 })
    })
  })

  describe('roadThreePoints', () => {
    it('flattens surface boundaries, road marks and lane centers into three-frame points', () => {
      const points = roadThreePoints({
        laneSurfaces: [
          { leftBoundary: [{ x: 1, y: 2, z: 0 }], rightBoundary: [{ x: 3, y: 4, z: 0 }] },
        ],
        roadMarks: [{ points: [{ x: 5, y: 6, z: 0 }] }],
        laneCenters: [{ points: [{ x: 7, y: 8, z: 0 }] }],
      })
      expect(points).toEqual([
        { x: 1, y: 0, z: -2 },
        { x: 3, y: 0, z: -4 },
        { x: 5, y: 0, z: -6 },
        { x: 7, y: 0, z: -8 },
      ])
    })

    it('returns an empty array for empty geometry', () => {
      expect(roadThreePoints({ laneSurfaces: [], roadMarks: [], laneCenters: [] })).toEqual([])
    })
  })

  describe('objectsCentroidThree', () => {
    it('returns the origin for no objects', () => {
      expect(objectsCentroidThree([])).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('averages positions in the three-frame', () => {
      const c = objectsCentroidThree([
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 8, z: 2 },
      ])
      expect(c).toEqual({ x: 2, y: 1, z: -4 })
    })
  })
})
