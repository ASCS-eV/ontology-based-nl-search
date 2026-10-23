/**
 * The refine path's SHACL gate knows every slot key the vocabulary resolves
 * (ADR 0009): a qualified key — one of several property paths that end in the
 * same local name — survives validation like a plain leaf name, and an
 * invented key is still dropped. Keys are picked from the live vocabulary of
 * the pinned ontology, so nothing here names a property.
 */
import { extractSchemaVocabulary, getInitializedStore } from '@ontology-search/search'
import { beforeAll, describe, expect, it } from 'vitest'

import { validateSlots } from '../services/validate-slots.js'

let qualifiedNumeric: { key: string; domain: string } | undefined
let qualifiedEnum: { key: string; domain: string; value: string } | undefined

beforeAll(async () => {
  const vocabulary = await extractSchemaVocabulary(await getInitializedStore())
  const numeric = vocabulary.numericProperties.find((p) => p.leafName)
  if (numeric) qualifiedNumeric = { key: numeric.localName, domain: numeric.domain }
  const enumerated = vocabulary.enumProperties.find((p) => p.leafName && p.allowedValues[0])
  if (enumerated) {
    qualifiedEnum = {
      key: enumerated.localName,
      domain: enumerated.domain,
      value: enumerated.allowedValues[0]!,
    }
  }
}, 180_000)

describe('validateSlots (refine) — property keys', () => {
  it('finds qualified keys in the pinned ontology (or this suite proves nothing)', () => {
    expect(qualifiedNumeric).toBeDefined()
    expect(qualifiedEnum).toBeDefined()
  })

  it('keeps a range on a qualified key', async () => {
    const { key, domain } = qualifiedNumeric!
    const { slots, gaps } = await validateSlots({
      domains: [domain],
      filters: {},
      ranges: { [key]: { min: 0 } },
    })
    expect(slots.ranges).toEqual({ [key]: { min: 0 } })
    expect(gaps).toEqual([])
  }, 120_000)

  it('keeps an allowed value of a qualified enumerated key', async () => {
    const { key, domain, value } = qualifiedEnum!
    const { slots, gaps } = await validateSlots({
      domains: [domain],
      filters: { [key]: value },
      ranges: {},
    })
    expect(slots.filters).toEqual({ [key]: value })
    expect(gaps).toEqual([])
  }, 120_000)

  it('still drops a range on a key no ontology declares', async () => {
    const { domain } = qualifiedNumeric!
    const { slots, gaps } = await validateSlots({
      domains: [domain],
      filters: {},
      ranges: { notAProperty__anywhere: { min: 0 } },
    })
    expect(slots.ranges).toEqual({})
    expect(gaps.length).toBeGreaterThan(0)
  }, 120_000)
})
