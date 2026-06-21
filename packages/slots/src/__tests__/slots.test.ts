import { describe, expect, it } from 'vitest'

import { gapWireSchema, referenceFilterWireSchema } from '../slot-wire-schema.js'
import { createEmptySlots, normalizeReferences, type ReferenceFilter } from '../slots.js'

describe('normalizeReferences', () => {
  // S1 — accepts undefined / single-object / array forms, always returns an array.
  it('returns [] for undefined', () => {
    expect(normalizeReferences(undefined)).toEqual([])
  })

  it('wraps a single object into an array', () => {
    expect(normalizeReferences({ domain: 'child' })).toEqual([{ domain: 'child' }])
  })

  it('passes an array through', () => {
    const arr: ReferenceFilter[] = [{ domain: 'a' }, { domain: 'b' }]
    expect(normalizeReferences(arr)).toEqual(arr)
  })

  // S2 — blank / whitespace-only domains are dropped at the boundary.
  it('drops entries with blank or whitespace-only domains', () => {
    expect(normalizeReferences([{ domain: '' }, { domain: '   ' }, { domain: 'keep' }])).toEqual([
      { domain: 'keep' },
    ])
  })

  // S3 — leaf nodes stay exactly { domain, label? }; an empty references key is stripped.
  it('strips an empty references key so leaf nodes stay { domain, label? }', () => {
    const result = normalizeReferences([{ domain: 'leaf', references: [] }])
    expect(result).toEqual([{ domain: 'leaf' }])
    expect('references' in result[0]!).toBe(false)
  })

  it('preserves a label on a leaf node', () => {
    expect(normalizeReferences({ domain: 'd', label: 'x' })).toEqual([{ domain: 'd', label: 'x' }])
  })

  // S3 — nested chains are preserved (and recursively normalized).
  it('preserves nested reference chains and normalizes them recursively', () => {
    const nested: ReferenceFilter = {
      domain: 'parent',
      references: [{ domain: 'child', references: [{ domain: 'grandchild' }] }],
    }
    expect(normalizeReferences(nested)).toEqual([
      {
        domain: 'parent',
        references: [{ domain: 'child', references: [{ domain: 'grandchild' }] }],
      },
    ])
  })

  it('drops blank-domain entries inside nested references too', () => {
    expect(normalizeReferences({ domain: 'p', references: [{ domain: '' }] })).toEqual([
      { domain: 'p' },
    ])
  })
})

describe('createEmptySlots', () => {
  it('creates empty slots targeting one domain', () => {
    expect(createEmptySlots('roads')).toEqual({ domains: ['roads'], filters: {}, ranges: {} })
  })
})

describe('referenceFilterWireSchema', () => {
  // S5 — validates nested cross-domain chains.
  it('accepts a nested chain with filters and ranges on the referenced asset', () => {
    const value = {
      domain: 'child',
      label: 'l',
      filters: { prop: 'v', multi: ['a', 'b'] },
      ranges: { count: { min: 1, max: 3 } },
      references: [{ domain: 'grandchild' }],
    }
    expect(referenceFilterWireSchema.parse(value)).toEqual(value)
  })

  // S5 — rejects entries missing the required `domain`.
  it('rejects a reference filter missing domain', () => {
    expect(referenceFilterWireSchema.safeParse({ label: 'no-domain' }).success).toBe(false)
  })
})

describe('gapWireSchema', () => {
  // S4 — wire schemas validate the LLM-facing JSON-Schema-grounded shapes.
  it('accepts a gap with optional suggestions', () => {
    expect(gapWireSchema.parse({ term: 't', reason: 'r', suggestions: ['s'] })).toEqual({
      term: 't',
      reason: 'r',
      suggestions: ['s'],
    })
  })

  it('rejects a gap missing reason', () => {
    expect(gapWireSchema.safeParse({ term: 't' }).success).toBe(false)
  })
})
