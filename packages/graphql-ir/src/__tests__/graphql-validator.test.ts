/**
 * GraphQL Validator tests — syntax gate + structural completeness.
 *
 * The completeness tests exist because of a real drift bug: the serializer
 * was given `appliedFilters` (string-only) instead of full slots, so range
 * filters like `numberIntersections(min: 1)` were silently dropped from
 * the GraphQL while still present in the SPARQL. These tests ensure every
 * slot key appears in the generated GraphQL — the same class of bug can
 * never ship again.
 */
import type { SearchSlots } from '@ontology-search/slots/slots'
import { describe, expect, it } from 'vitest'

import { slotsToGraphQL } from '../graphql-serializer.js'
import { validateGraphQL, validateGraphQLCompleteness } from '../graphql-validator.js'

describe('validateGraphQL — syntax gate', () => {
  it('accepts a valid query', () => {
    const result = validateGraphQL('query { hdmap { country(values: ["DE"]) } }')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects an empty string', () => {
    const result = validateGraphQL('')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('empty')
  })

  it('rejects invalid GraphQL syntax', () => {
    const result = validateGraphQL('query { hdmap { country(values: ["DE") } }')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('parse error')
  })

  it('accepts query with range arguments', () => {
    const result = validateGraphQL('query { hdmap { numberOfLanes(min: 3, max: 5) } }')
    expect(result.valid).toBe(true)
  })

  it('accepts multi-domain query', () => {
    const result = validateGraphQL('query { hdmap { country(values: ["DE"]) } scenario { _all } }')
    expect(result.valid).toBe(true)
  })
})

describe('validateGraphQLCompleteness — drift prevention', () => {
  it('passes when all slots are represented', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: ['DE', 'FR'] },
      ranges: { numberOfLanes: { min: 3 } },
    }
    const graphql = slotsToGraphQL(slots)
    const result = validateGraphQLCompleteness(graphql, slots)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects missing filter field', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: 'DE', roadType: 'motorway' },
      ranges: {},
    }
    // Manually craft a GraphQL that omits roadType
    const incomplete = 'query { hdmap { country(values: ["DE"]) } }'
    const result = validateGraphQLCompleteness(incomplete, slots)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('roadType')
  })

  it('detects missing range field (the exact bug from customer demo)', () => {
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: ['AT', 'DE', 'FR'] },
      ranges: { numberIntersections: { min: 1 } },
    }
    // Simulate the old bug: GraphQL built from filters only, missing range
    const drifted = 'query { hdmap { country(values: ["AT", "DE", "FR"]) } }'
    const result = validateGraphQLCompleteness(drifted, slots)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('numberIntersections')
  })

  it('detects missing domain', () => {
    const slots: SearchSlots = {
      domains: ['hdmap', 'scenario'],
      filters: {},
      ranges: {},
    }
    // Only includes hdmap, not scenario
    const partial = 'query { hdmap { _all } }'
    const result = validateGraphQLCompleteness(partial, slots)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('scenario')
  })

  it('handles empty slots', () => {
    const slots: SearchSlots = { domains: [], filters: {}, ranges: {} }
    const graphql = slotsToGraphQL(slots)
    const result = validateGraphQLCompleteness(graphql, slots)
    expect(result.valid).toBe(true)
  })
})

describe('slotsToGraphQL — all outputs are spec-valid GraphQL', () => {
  const testCases: { name: string; slots: SearchSlots }[] = [
    {
      name: 'empty slots',
      slots: { domains: [], filters: {}, ranges: {} },
    },
    {
      name: 'single domain, no filters',
      slots: { domains: ['hdmap'], filters: {}, ranges: {} },
    },
    {
      name: 'single filter',
      slots: { domains: ['hdmap'], filters: { country: 'DE' }, ranges: {} },
    },
    {
      name: 'multiple filters',
      slots: {
        domains: ['hdmap'],
        filters: { country: ['DE', 'FR'], roadType: 'motorway' },
        ranges: {},
      },
    },
    {
      name: 'range only',
      slots: { domains: ['hdmap'], filters: {}, ranges: { numberOfLanes: { min: 3 } } },
    },
    {
      name: 'filters + ranges',
      slots: {
        domains: ['hdmap'],
        filters: { country: ['AT', 'DE'] },
        ranges: { numberIntersections: { min: 1 }, numberOfLanes: { min: 2, max: 6 } },
      },
    },
    {
      name: 'multi-domain',
      slots: {
        domains: ['hdmap', 'scenario'],
        filters: { country: 'DE' },
        ranges: {},
      },
    },
    {
      name: 'with references',
      slots: {
        domains: ['hdmap'],
        filters: {},
        ranges: {},
        references: [{ domain: 'scenario' }],
      },
    },
  ]

  for (const tc of testCases) {
    it(`produces valid GraphQL for: ${tc.name}`, () => {
      const graphql = slotsToGraphQL(tc.slots)
      const result = validateGraphQL(graphql)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it(`is structurally complete for: ${tc.name}`, () => {
      const graphql = slotsToGraphQL(tc.slots)
      const result = validateGraphQLCompleteness(graphql, tc.slots)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  }
})
