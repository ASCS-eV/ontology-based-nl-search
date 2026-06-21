import type { SearchSlots } from '@ontology-search/slots/slots'
import { describe, expect, it } from 'vitest'

import { slotsToGraphQL } from '../graphql-serializer.js'

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

  it('emits enum literals (unquoted) for enum-encoded properties', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: ['DE', 'AT'], roadType: 'motorway' },
      ranges: {},
    }

    const result = slotsToGraphQL(slots, { enumProperties: new Set(['country', 'roadType']) })

    expect(result).toContain('country(values: [AT, DE])')
    expect(result).toContain('roadType(values: [motorway])')
  })

  it('keeps non-enum properties as quoted strings', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: 'DE', name: 'A19' },
      ranges: {},
    }

    const result = slotsToGraphQL(slots, { enumProperties: new Set(['country']) })

    expect(result).toContain('country(values: [DE])')
    expect(result).toContain('name(values: ["A19"])')
  })

  it('falls back to a quoted string when an enum-encoded value is not a valid enum name', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { region: 'A/B' },
      ranges: {},
    }

    const result = slotsToGraphQL(slots, { enumProperties: new Set(['region']) })

    expect(result).toContain('region(values: ["A/B"])')
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

  it('handles references as a nested field block', () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap' }],
    }

    const result = slotsToGraphQL(slots)

    // A reference with no constraints renders as `<domain> { _all }` under a
    // `references` field — not an argument.
    expect(result).toContain('references {')
    expect(result).toContain('hdmap {')
    expect(result).toContain('_all')
    expect(result).not.toContain('references: [')
  })

  it('handles nested references (reference of a reference)', () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'ositrace', references: [{ domain: 'hdmap' }] }],
    }

    const result = slotsToGraphQL(slots)

    // ositrace block carries its own `references { hdmap { _all } }`.
    expect(result).toContain('ositrace {')
    expect(result.match(/references \{/g)?.length).toBe(2)
    expect(result).toContain('hdmap {')
  })

  it('emits a reference label as an argument on the referenced-domain field', () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap', label: 'German highways' }],
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('hdmap(label: "German highways") {')
  })

  it('serializes reference-scoped filters and ranges as nested fields', () => {
    const slots: SearchSlots = {
      domains: ['ositrace'],
      filters: {},
      ranges: {},
      references: [
        {
          domain: 'hdmap',
          filters: { country: 'DE' },
          ranges: { numberIntersections: { min: 1 } },
        },
      ],
    }

    const result = slotsToGraphQL(slots)

    expect(result).toContain('country(values: ["DE"])')
    expect(result).toContain('numberIntersections(min: 1)')
  })

  it('emits enum literals for enum-encoded reference filter values', () => {
    const slots: SearchSlots = {
      domains: ['ositrace'],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap', filters: { roadType: 'motorway' } }],
    }

    const result = slotsToGraphQL(slots, { enumProperties: new Set(['roadType']) })

    // Unquoted enum literal (so the editor schema's per-name enum suggests it),
    // exactly as top-level filters do — references reuse the same rendering.
    expect(result).toContain('roadType(values: [motorway])')
    expect(result).not.toContain('roadType(values: ["motorway"])')
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
