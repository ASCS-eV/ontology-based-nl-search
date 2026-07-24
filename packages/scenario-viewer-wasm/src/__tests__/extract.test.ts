import { describe, expect, it } from 'vitest'

import { drainVector, extractFrame, extractRoadGeometry } from '../extract.js'
import { HandleRegistry, objectState, rawFrame, rawRoadGeometry, TrackedVector } from './mocks.js'

describe('drainVector', () => {
  it('copies every element out and frees the handle', () => {
    const vec = new TrackedVector([1, 2, 3])
    const out = drainVector(vec, (n) => n * 10)
    expect(out).toEqual([10, 20, 30])
    expect(vec.deleted).toBe(true)
    expect(vec.deleteCount).toBe(1)
  })

  it('frees the handle even if the mapper throws', () => {
    const vec = new TrackedVector([1, 2, 3])
    expect(() =>
      drainVector(vec, () => {
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(vec.deleted).toBe(true)
  })

  it('handles an empty vector without leaking', () => {
    const vec = new TrackedVector<number>([])
    expect(drainVector(vec, (n) => n)).toEqual([])
    expect(vec.deleted).toBe(true)
  })
})

describe('extractFrame', () => {
  it('maps snake_case fields to the plain-JS camelCase frame', () => {
    const registry = new HandleRegistry()
    const raw = rawFrame(registry, [objectState({ name: 'A2', id: 2, lane_id: -4, s: 620 })])
    const frame = extractFrame(raw)

    expect(frame.simulationTime).toBe(1.5)
    expect(frame.timeStep).toBe(0.05)
    expect(frame.status).toBe(0)
    expect(frame.quit).toBe(false)
    expect(frame.objects).toHaveLength(1)
    expect(frame.objects[0]).toMatchObject({
      name: 'A2',
      id: 2,
      roadId: 37,
      laneId: -4,
      s: 620,
      speed: 27.78,
    })
  })

  it('frees the object_states handle (no leak per frame)', () => {
    const registry = new HandleRegistry()
    extractFrame(rawFrame(registry, [objectState(), objectState({ id: 1 })]))
    expect(registry.liveCount()).toBe(0)
  })
})

describe('extractRoadGeometry', () => {
  it('extracts the full nested geometry tree to plain JS', () => {
    const registry = new HandleRegistry()
    const geometry = extractRoadGeometry(rawRoadGeometry(registry))

    expect(geometry.odrFilename).toBe('german_highway_short.xodr')
    expect(geometry.laneSurfaces).toHaveLength(2)
    expect(geometry.laneSurfaces[0]?.laneId).toBe(-3)
    expect(geometry.laneSurfaces[0]?.leftBoundary).toHaveLength(2)
    expect(geometry.laneSurfaces[0]?.leftBoundary[1]?.endpoint).toBe(true)
    expect(geometry.laneSurfaces[1]?.roadEdge).toBe(true)
    expect(geometry.roadMarks[0]).toMatchObject({ type: 'broken', color: 'white', lineSpace: 6 })
    expect(geometry.roadMarks[0]?.points).toHaveLength(2)
    expect(geometry.laneCenters[0]).toMatchObject({ centerLane: true, referenceLine: false })
    expect(geometry.roadObjects[0]).toMatchObject({ name: 'barrier', widthStart: 0.3 })
    expect(geometry.roadFeatureBoxes[0]).toMatchObject({ name: 'sign', kind: 'speed', width: 0.5 })
  })

  it('frees every handle: the 5 top-level vectors plus all nested polylines', () => {
    const registry = new HandleRegistry()
    extractRoadGeometry(rawRoadGeometry(registry))
    // 5 top-level + (2 surfaces * 2 boundaries) + 1 mark points + 1 centre points
    // + 1 object points = 12 vector handles.
    expect(registry.vectors).toHaveLength(12)
    expect(registry.liveCount()).toBe(0)
    for (const vec of registry.vectors) expect(vec.deleteCount).toBe(1)
  })
})
