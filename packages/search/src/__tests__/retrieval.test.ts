/**
 * Retrieval integration tests against the real ontology.
 *
 * Queries are DERIVED FROM THE INDEX ITSELF (a card's own labels/values),
 * so every assertion is ontology-agnostic and survives an ontology swap —
 * the fixtures adapt to whatever schema is loaded.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import type { SparqlStore, TermCard, TermIndex } from '../index.js'
import { getInitializedStore } from '../init.js'
import { retrieveRelevantSchema, warmupRetrievalIndex } from '../schema-index/retrieval.js'
import { buildTermIndex } from '../schema-index/term-index.js'

let store: SparqlStore
let index: TermIndex

/** A distinctive enum card: multi-char label + at least one allowed value. */
function pickEnumCard(): TermCard {
  const card = index.cards.find(
    (c) =>
      c.kind === 'property' &&
      c.allowedValues &&
      c.allowedValues.length > 0 &&
      c.labels.some((l) => l.length >= 4)
  )
  expect(card, 'ontology must declare at least one sh:in property').toBeDefined()
  return card!
}

beforeAll(async () => {
  store = await getInitializedStore()
  await warmupRetrievalIndex(store)
  index = await buildTermIndex(store)
}, 120_000)

describe('retrieveRelevantSchema — routing and selection', () => {
  it('routes a single-domain query to its domain with high confidence', async () => {
    const card = pickEnumCard()
    const query = `${card.labels[0]} ${card.allowedValues![0]}`

    const retrieved = await retrieveRelevantSchema(store, query)

    expect(retrieved.domains).toContain(card.domain)
    expect(retrieved.confidence).toBeGreaterThanOrEqual(0.5)
    expect(
      retrieved.cards.some((c) => c.iri === card.iri && c.domain === card.domain),
      `card ${card.iri} must survive selection`
    ).toBe(true)
  })

  it('returns cards from multiple domains for a cross-domain query', async () => {
    const first = pickEnumCard()
    const second = index.cards.find(
      (c) =>
        c.kind === 'property' && c.domain !== first.domain && c.labels.some((l) => l.length >= 4)
    )
    expect(second).toBeDefined()

    const query = `${first.labels[0]} ${second!.labels[0]}`
    const retrieved = await retrieveRelevantSchema(store, query)

    const cardDomains = new Set(retrieved.cards.map((c) => c.domain))
    expect(cardDomains.size).toBeGreaterThanOrEqual(2)
  })

  it('pulls the referenced dependency domain for object properties (transitive expansion)', async () => {
    const edge = index.cards.find(
      (c) => c.kind === 'property' && c.referencesDomain && c.referencesDomain !== c.domain
    )
    expect(edge, 'schema must declare at least one cross-domain reference').toBeDefined()

    const retrieved = await retrieveRelevantSchema(store, edge!.labels[0]!)

    const reachable = new Set([...retrieved.domains, ...retrieved.cards.map((c) => c.domain)])
    expect(reachable.has(edge!.referencesDomain!)).toBe(true)
  })

  it('preserves gap detection: nonsense queries yield low confidence but the full catalog', async () => {
    const retrieved = await retrieveRelevantSchema(store, 'zzqx flibber blorp')

    expect(retrieved.confidence).toBeLessThan(0.2)
    expect(retrieved.catalog.length).toBe(index.domainCatalog.length)
  })

  it('is deterministic: identical queries produce identical results', async () => {
    const card = pickEnumCard()
    const query = card.labels[0]!
    const a = await retrieveRelevantSchema(store, query)
    const b = await retrieveRelevantSchema(store, query)
    expect(b).toEqual(a)
  })
})

describe('retrieveRelevantSchema — fragments, budgets, abort', () => {
  it('extracts SHACL fragments for the selected properties only when asked', async () => {
    const card = pickEnumCard()
    const withFragments = await retrieveRelevantSchema(store, card.labels[0]!)
    expect(withFragments.fragments.length).toBeGreaterThan(0)
    for (const fragment of withFragments.fragments) {
      expect(fragment.turtle).toContain('sh:path')
    }

    const distilled = await retrieveRelevantSchema(store, card.labels[0]!, {
      includeFragments: false,
    })
    expect(distilled.fragments).toEqual([])
  })

  it('respects the primary-domain and card budgets', async () => {
    const card = pickEnumCard()
    const retrieved = await retrieveRelevantSchema(store, card.labels[0]!, {
      maxDomains: 1,
      maxCards: 5,
    })

    expect(retrieved.domains.length).toBeLessThanOrEqual(1)
    // Dependency-domain cards ride on a separate bounded budget; primary
    // selection itself must respect maxCards.
    const primary = retrieved.cards.filter((c) => retrieved.domains.includes(c.domain))
    expect(primary.length).toBeLessThanOrEqual(5)
  })

  it('propagates abort before running schema queries', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      retrieveRelevantSchema(store, 'anything', { signal: controller.signal })
    ).rejects.toThrow()
  })
})
