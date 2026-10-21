/**
 * The GraphQL refine contract accepts every slot key (ADR 0009), including a
 * bare leaf name the ontology reaches only through qualified keys — the name
 * the model uses when the user does not tell the chains apart. Slots on every
 * such name are serialized and validated against the contract built from the
 * pinned ontology, exactly as `/search/refine-graphql` does.
 */
import { slotsToGraphQL } from '@ontology-search/graphql-ir'
import { buildTermIndex, getInitializedStore, toVocabularyResponse } from '@ontology-search/search'
import type { SearchSlots } from '@ontology-search/slots/slots'
import { parse, validate } from 'graphql'
import { describe, expect, it } from 'vitest'

import { getGraphQLContract } from '../graphql-schema.js'

describe('GraphQL contract — property keys', () => {
  it('validates slots on every key, bare names over qualified keys included', async () => {
    const contract = await getGraphQLContract()
    const vocabulary = toVocabularyResponse(await buildTermIndex(await getInitializedStore()))
    const keys = new Set(vocabulary.properties.map((p) => `${p.domain}:${p.name}`))
    const bare = vocabulary.properties.filter((p) => p.description.startsWith('Any of '))
    expect(bare.length).toBeGreaterThan(0)

    const failures: string[] = []
    for (const property of bare) {
      expect(keys.has(`${property.domain}:${property.name}`)).toBe(true)
      const slots: SearchSlots =
        property.type === 'numeric'
          ? { domains: [property.domain], filters: {}, ranges: { [property.name]: { min: 0 } } }
          : {
              domains: [property.domain],
              filters: { [property.name]: property.allowedValues?.[0] ?? 'x' },
              ranges: {},
            }
      const query = slotsToGraphQL(slots, { enumProperties: contract.enumProperties })
      const errors = validate(contract.schema, parse(query)).map((e) => e.message)
      if (errors.length > 0) failures.push(`${property.domain}:${property.name}: ${errors[0]}`)
    }
    expect(failures).toEqual([])
  }, 180_000)
})
