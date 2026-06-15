import { describe, expect, it } from 'vitest'

import { slotsToGraphQL } from '../graphql-serializer.js'
import type { SearchSlots } from '../slots.js'

describe('slotsToGraphQL', () => {
  it('produces a query with single domain and filters', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: 'Germany', roadType: 'motorway' },
      ranges: {},
    }

    const result = slotsToGraphQL(slots)

    expect(result).toBe(
      [
        'query {',
        '  hdmap {',
        '    country(values: ["Germany"])',
        '    roadType(values: ["motorway"])',
        '  }',
        '}',
      ].join('\n')
    )
  })

  it('handles array filter values (sorted)', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: ['France', 'Germany', 'Austria'] },
      ranges: {},
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('country(values: ["Austria", "France", "Germany"])')
  })

  it('handles numeric range filters', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: { numberOfLanes: { min: 3 } },
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('numberOfLanes(min: 3)')
  })

  it('handles range with both min and max', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: { numberOfLanes: { min: 2, max: 5 } },
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('numberOfLanes(min: 2, max: 5)')
  })

  it('handles references', () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap' }],
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('scenario(references: [{ domain: "hdmap" }])')
  })

  it('handles nested references', () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'ositrace', references: [{ domain: 'hdmap' }] }],
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain(
      'references: [{ domain: "ositrace", references: [{ domain: "hdmap" }] }]'
    )
  })

  it('handles references with label', () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap', label: 'German highways' }],
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('domain: "hdmap", label: "German highways"')
  })

  it('sorts domains alphabetically', () => {
    const slots: SearchSlots = {
      domains: ['scenario', 'hdmap'],
      filters: { country: 'Germany' },
      ranges: {},
    }

    const result = slotsToGraphQL(slots)

    const hdmapIdx = result.indexOf('hdmap {')
    const scenarioIdx = result.indexOf('scenario {')
    expect(hdmapIdx).toBeLessThan(scenarioIdx)
  })

  it('handles empty domains', () => {
    const slots: SearchSlots = {
      domains: [],
      filters: {},
      ranges: {},
    }

    const result = slotsToGraphQL(slots)

    expect(result).toBe('query {\n  _empty\n}')
  })

  it('handles domain with no filters', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('_all')
  })

  it('escapes special characters in string values', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { description: 'Line 1\nLine "2"' },
      ranges: {},
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('description(values: ["Line 1\\nLine \\"2\\""])')
  })

  it('produces deterministic output (same input = same output)', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { roadType: 'motorway', country: 'Germany', format: 'OpenDRIVE' },
      ranges: { numberOfLanes: { min: 3 } },
      references: [{ domain: 'scenario' }],
    }

    const result1 = slotsToGraphQL(slots)
    const result2 = slotsToGraphQL(slots)

    expect(result1).toBe(result2)
  })

  it('sorts filter keys alphabetically for determinism', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { zProperty: 'z', aProperty: 'a', mProperty: 'm' },
      ranges: {},
    }

    const result = slotsToGraphQL(slots)

    const aIdx = result.indexOf('aProperty')
    const mIdx = result.indexOf('mProperty')
    const zIdx = result.indexOf('zProperty')
    expect(aIdx).toBeLessThan(mIdx)
    expect(mIdx).toBeLessThan(zIdx)
  })

  it('combines filters and ranges for same property', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: 'Germany' },
      ranges: { numberOfLanes: { min: 3 } },
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('country(values: ["Germany"])')
    expect(result).toContain('numberOfLanes(min: 3)')
  })
})
