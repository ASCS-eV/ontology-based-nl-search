import type { SearchSlots } from '@ontology-search/slots/slots'
import { describe, expect, it } from 'vitest'

import { buildGraphQLNameMap } from '../graphql-name.js'
import { parseGraphQLToSlots } from '../graphql-parser.js'
import { slotsToGraphQL } from '../graphql-serializer.js'

describe('parseGraphQLToSlots', () => {
  it('round-trips a basic query with filters', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: ['DE', 'AT'], roadType: 'motorway' },
      ranges: {},
    }

    const graphql = slotsToGraphQL(slots)
    const result = parseGraphQLToSlots(graphql)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual(['hdmap'])
      expect(result.slots.filters).toEqual({ country: ['AT', 'DE'], roadType: 'motorway' })
    }
  })

  it('round-trips enum-literal filter values back to strings', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: ['DE', 'AT'] },
      ranges: {},
    }

    const graphql = slotsToGraphQL(slots, { enumProperties: new Set(['country']) })
    expect(graphql).toContain('country(values: [AT, DE])') // unquoted enum literals

    const result = parseGraphQLToSlots(graphql)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.filters).toEqual({ country: ['AT', 'DE'] })
    }
  })

  it('round-trips a query with ranges', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: { numberOfLanes: { min: 3, max: 6 } },
    }

    const graphql = slotsToGraphQL(slots)
    const result = parseGraphQLToSlots(graphql)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual(['hdmap'])
      expect(result.slots.ranges).toEqual({ numberOfLanes: { min: 3, max: 6 } })
    }
  })

  it('round-trips a multi-domain query', () => {
    const slots: SearchSlots = {
      domains: ['hdmap', 'scenario'],
      filters: { country: 'DE' },
      ranges: {},
    }

    const graphql = slotsToGraphQL(slots)
    const result = parseGraphQLToSlots(graphql)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual(['hdmap', 'scenario'])
      expect(result.slots.filters).toEqual({ country: 'DE' })
    }
  })

  it('round-trips reference-scoped filters and ranges', () => {
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

    const result = parseGraphQLToSlots(slotsToGraphQL(slots))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.references).toEqual([
        {
          domain: 'hdmap',
          filters: { country: 'DE' },
          ranges: { numberIntersections: { min: 1 } },
        },
      ])
    }
  })

  it('round-trips nested references', () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: {},
      ranges: {},
      references: [{ domain: 'ositrace', references: [{ domain: 'hdmap' }] }],
    }

    const result = parseGraphQLToSlots(slotsToGraphQL(slots))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.references).toEqual([
        { domain: 'ositrace', references: [{ domain: 'hdmap' }] },
      ])
    }
  })

  it('round-trips a reference with an enum filter, a range, a label, and a nested reference', () => {
    const slots: SearchSlots = {
      domains: ['ositrace'],
      filters: {},
      ranges: {},
      references: [
        {
          domain: 'hdmap',
          label: 'German highways',
          filters: { roadType: 'motorway' },
          ranges: { numberIntersections: { min: 1, max: 4 } },
          references: [{ domain: 'scenario' }],
        },
      ],
    }

    // Enum literals (unquoted) must parse back to the same string values.
    const result = parseGraphQLToSlots(
      slotsToGraphQL(slots, { enumProperties: new Set(['roadType']) })
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.references).toEqual([
        {
          domain: 'hdmap',
          label: 'German highways',
          filters: { roadType: 'motorway' },
          ranges: { numberIntersections: { min: 1, max: 4 } },
          references: [{ domain: 'scenario' }],
        },
      ])
    }
  })

  it('handles empty domains (_empty placeholder)', () => {
    const slots: SearchSlots = {
      domains: [],
      filters: {},
      ranges: {},
    }

    const graphql = slotsToGraphQL(slots)
    const result = parseGraphQLToSlots(graphql)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual([])
      expect(result.slots.filters).toEqual({})
      expect(result.slots.ranges).toEqual({})
    }
  })

  it('handles domain with _all placeholder (no filters)', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
    }

    const graphql = slotsToGraphQL(slots)
    const result = parseGraphQLToSlots(graphql)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual(['hdmap'])
      expect(result.slots.filters).toEqual({})
      expect(result.slots.ranges).toEqual({})
    }
  })

  it('returns parse error for invalid syntax', () => {
    const result = parseGraphQLToSlots('this is not graphql {{{')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Syntax error')
    }
  })

  it('parses user-edited query with removed filter', () => {
    // Simulate user removing "roadType" filter
    const editedQuery = `query {
  hdmap {
    country(values: ["DE"])
  }
}`
    const result = parseGraphQLToSlots(editedQuery)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual(['hdmap'])
      expect(result.slots.filters).toEqual({ country: 'DE' })
      expect(result.slots.ranges).toEqual({})
    }
  })

  it('parses user-edited query with added filter', () => {
    const editedQuery = `query {
  hdmap {
    country(values: ["DE", "FR"])
    numberOfLanes(min: 2)
  }
}`
    const result = parseGraphQLToSlots(editedQuery)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual(['hdmap'])
      expect(result.slots.filters).toEqual({ country: ['DE', 'FR'] })
      expect(result.slots.ranges).toEqual({ numberOfLanes: { min: 2 } })
    }
  })

  it('restores sanitized ontology names at every reference depth', () => {
    const slots: SearchSlots = {
      domains: ['asset-domain'],
      filters: { 'lane-count': '2' },
      ranges: {},
      references: [
        {
          domain: 'other-domain',
          filters: { 'display-name': 'Example' },
        },
      ],
    }
    const nameMap = buildGraphQLNameMap({
      domains: ['asset-domain', 'other-domain'],
      properties: [
        {
          name: 'lane-count',
          label: 'Lane count',
          description: '',
          domain: 'asset-domain',
          type: 'string',
        },
        {
          name: 'display-name',
          label: 'Display name',
          description: '',
          domain: 'other-domain',
          type: 'string',
        },
      ],
    })

    const result = parseGraphQLToSlots(slotsToGraphQL(slots), { nameMap })
    expect(result).toEqual({ success: true, slots })
  })

  // A construct rejected here parses AND schema-validates; without the guard its
  // nested constraints would be silently dropped, so the API would 200 an
  // under-constrained search. Each must instead fail with a bounded error.
  it('rejects fragment spreads instead of dropping their fields', () => {
    const result = parseGraphQLToSlots(
      'query { hdmap { ...F } } fragment F on hdmap_Result { country(values: ["DE"]) }'
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/fragment/i)
  })

  it('rejects inline fragments instead of dropping their fields', () => {
    const result = parseGraphQLToSlots(
      'query { hdmap { ... on hdmap_Result { country(values: ["DE"]) } } }'
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/inline fragment/i)
  })

  it('rejects variable-valued arguments instead of dropping the filter', () => {
    const result = parseGraphQLToSlots('query ($v: [String]) { hdmap { country(values: $v) } }')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/variable/i)
  })

  it('rejects directives instead of ignoring their semantics', () => {
    const result = parseGraphQLToSlots(
      'query { hdmap { country(values: ["DE"]) @skip(if: true) } }'
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/directive/i)
  })

  it('deduplicates a repeated top-level domain while merging its constraints', () => {
    const result = parseGraphQLToSlots(
      'query { hdmap { country(values: ["DE"]) } hdmap { roadType(values: ["motorway"]) } }'
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.slots.domains).toEqual(['hdmap'])
      expect(result.slots.filters).toEqual({ country: 'DE', roadType: 'motorway' })
    }
  })
})
