/**
 * The gold corpora must stay grounded in the loaded ontology.
 *
 * This lives in the test suite, not only behind `pnpm eval:models check`, so
 * an ontology bump that invalidates an expected domain, property, enum or IRI
 * fails `pnpm run validate` instead of waiting for someone to run the CLI by
 * hand. It also covers `findUnknownIdentifiers`, which decides the
 * `inventedIdentifierCount` quality gate.
 */
import { buildTermIndex, getInitializedStore } from '@ontology-search/search'
import { beforeAll, describe, expect, it } from 'vitest'

import { envitedGoldCases } from '../corpus.js'
import { findUnknownIdentifiers, validateGoldCorpus } from '../ontology-validation.js'

let termIndex: Awaited<ReturnType<typeof buildTermIndex>>

beforeAll(async () => {
  termIndex = await buildTermIndex(await getInitializedStore())
}, 180_000)

describe('gold corpus ontology grounding', () => {
  it('resolves every expected domain, property and enum value in the ENVITED-X corpus', async () => {
    const result = await validateGoldCorpus(envitedGoldCases)
    expect(result.caseCount).toBe(envitedGoldCases.length)
    expect(result.domainCount).toBeGreaterThan(0)
    expect(result.propertyCount).toBeGreaterThan(0)
  }, 180_000)

  it('reports an unresolvable expectation instead of silently accepting it', async () => {
    const [sample] = envitedGoldCases
    if (!sample) throw new Error('corpus is empty')
    await expect(
      validateGoldCorpus([
        {
          ...sample,
          id: 'env-999',
          expected: {
            ...sample.expected,
            slots: { domains: ['no-such-domain'], filters: {}, ranges: {} },
          },
        },
      ])
    ).rejects.toThrow(/unknown domain "no-such-domain"/)
  })

  it('flags invented identifiers a model returned but the ontology does not define', () => {
    expect(findUnknownIdentifiers(null, termIndex)).toEqual([])
    expect(findUnknownIdentifiers({ domains: [], filters: {}, ranges: {} }, termIndex)).toEqual([])

    const invented = findUnknownIdentifiers(
      { domains: ['definitely-not-a-domain'], filters: {}, ranges: {} },
      termIndex
    )
    expect(invented).toHaveLength(1)
    expect(invented[0]).toMatch(/definitely-not-a-domain/)
  })

  it('deduplicates and sorts findings so the gate count is stable', () => {
    const invented = findUnknownIdentifiers(
      { domains: ['zzz-unknown', 'aaa-unknown', 'zzz-unknown'], filters: {}, ranges: {} },
      termIndex
    )
    expect(invented).toHaveLength(2)
    expect([...invented]).toEqual([...invented].sort())
  })
})
