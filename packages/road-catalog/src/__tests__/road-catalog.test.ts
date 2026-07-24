import { describe, expect, it } from 'vitest'

import {
  defaultRoad,
  describeRoadForPrompt,
  entrySegment,
  getRoad,
  ROADS,
  travelSideLanes,
} from '../index.js'
import type { CatalogRoad } from '../types.js'

/** Build a synthetic single-segment road so the pure accessors can be exercised on
 *  topologies (LHT, missing entry, no successor, single lane) the vendored road
 *  does not provide. */
function makeRoad(over: Partial<CatalogRoad> & Pick<CatalogRoad, 'topology'>): CatalogRoad {
  return {
    id: 'synthetic',
    logicFile: 'synthetic.xodr',
    description: 'synthetic test road',
    xodr: '<OpenDRIVE/>',
    provenance: { spdx: 'MPL-2.0', source: 'test', commit: 'x', attribution: 'test' },
    ...over,
  }
}

describe('road catalog data', () => {
  it('vendors at least one road, with the default being a German highway', () => {
    expect(ROADS.length).toBeGreaterThan(0)
    const road = defaultRoad()
    expect(road.id).toBe('german_highway_short')
    expect(road.logicFile).toBe('german_highway_short.xodr')
  })

  it('embeds real OpenDRIVE bytes that contain the discovered entry road', () => {
    const road = defaultRoad()
    expect(road.xodr).toContain('<OpenDRIVE>')
    expect(road.xodr).toContain(`id="${road.topology.entryRoadId}"`)
  })

  it('carries MPL-2.0 provenance pinned to a full commit sha', () => {
    const { provenance } = defaultRoad()
    expect(provenance.spdx).toBe('MPL-2.0')
    expect(provenance.source).toContain('asam-openx-assets')
    expect(provenance.commit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('every discovered drivable lane is actually a driving lane with a finite road length', () => {
    for (const road of ROADS) {
      for (const seg of road.topology.roads) {
        expect(Number.isFinite(seg.length)).toBe(true)
        expect(seg.length).toBeGreaterThan(0)
        for (const lane of seg.drivableLanes) {
          expect(lane.type).toBe('driving')
          expect(lane.side).toBe(Number(lane.laneId) < 0 ? 'right' : 'left')
        }
      }
    }
  })
})

describe('getRoad', () => {
  it('resolves by the bare filename regardless of a path prefix or separator', () => {
    expect(getRoad('german_highway_short.xodr')?.id).toBe('german_highway_short')
    expect(getRoad('xodr/german_highway_short.xodr')?.id).toBe('german_highway_short')
    expect(getRoad('Databases\\german_highway_short.xodr')?.id).toBe('german_highway_short')
  })

  it('returns undefined for an unknown road', () => {
    expect(getRoad('does_not_exist.xodr')).toBeUndefined()
  })
})

describe('topology accessors', () => {
  it('entrySegment returns the head of the road chain', () => {
    const road = defaultRoad()
    const entry = entrySegment(road)
    expect(entry.id).toBe('37')
    expect(entry.length).toBeGreaterThan(900)
    expect(entry.successorRoadId).toBe('46')
  })

  it('travelSideLanes returns the RHT right-side driving lanes, inner→outer', () => {
    const road = defaultRoad()
    const lanes = travelSideLanes(road)
    expect(lanes.map((l) => l.laneId)).toEqual(['-3', '-4'])
    expect(lanes.every((l) => l.side === 'right')).toBe(true)
  })
})

describe('describeRoadForPrompt', () => {
  it('derives placement guidance from the topology (road, lanes, s-range, logicFile)', () => {
    const text = describeRoadForPrompt(defaultRoad())
    expect(text).toContain('german_highway_short.xodr')
    expect(text).toContain('road id 37')
    expect(text).toContain('-3')
    expect(text).toContain('-4')
    expect(text).toContain('right-hand traffic')
    expect(text).toMatch(/\[0, 924\]/)
    expect(text).toContain('do not invent other road or lane ids')
  })

  it('describes a left-hand single-lane road with no successor without inner/outer wording', () => {
    const road = makeRoad({
      logicFile: 'lht_single.xodr',
      topology: {
        rule: 'LHT',
        entryRoadId: '5',
        roads: [
          {
            id: '5',
            length: 300.5,
            drivableLanes: [{ roadId: '5', laneId: '2', type: 'driving', side: 'left' }],
          },
        ],
      },
    })
    const text = describeRoadForPrompt(road)
    expect(text).toContain('left-hand traffic')
    expect(text).toContain('road id 5')
    expect(text).toContain('lht_single.xodr')
    expect(text).not.toContain('It continues into road')
    expect(text).not.toContain('inner lane')
    expect(text).toMatch(/\[0, 300\]/)
  })
})

describe('topology accessor edge cases', () => {
  it('travelSideLanes returns the LHT left-side driving lanes, inner→outer', () => {
    const road = makeRoad({
      topology: {
        rule: 'LHT',
        entryRoadId: '5',
        roads: [
          {
            id: '5',
            length: 100,
            drivableLanes: [
              { roadId: '5', laneId: '2', type: 'driving', side: 'left' },
              { roadId: '5', laneId: '1', type: 'driving', side: 'left' },
              { roadId: '5', laneId: '-1', type: 'driving', side: 'right' },
            ],
          },
        ],
      },
    })
    expect(travelSideLanes(road).map((l) => l.laneId)).toEqual(['1', '2'])
  })

  it('entrySegment throws when the entry road id is absent from the topology', () => {
    const road = makeRoad({
      topology: { rule: 'RHT', entryRoadId: '999', roads: [] },
    })
    expect(() => entrySegment(road)).toThrow(/entry road 999 not found/)
  })
})
