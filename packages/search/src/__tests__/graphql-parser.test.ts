import { describe, expect, it } from 'vitest'

import { parseGraphQLToSlots } from '../graphql-parser'
import { slotsToGraphQL } from '../graphql-serializer'
import type { SearchSlots } from '../slots'

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
})
