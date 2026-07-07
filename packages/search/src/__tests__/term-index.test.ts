/**
 * Term-index integration tests against the real ontology.
 *
 * All assertions are generic — they hold for ANY loaded ontology set
 * (composition + coverage invariants), with one exception: proving the
 * largest shipped domain (gx, 2.3 MB of raw SHACL) is fully indexed from
 * the schema graph. Naming a real domain in a test is allowed (CLAUDE.md
 * ontology-name budget: tests may).
 */
import { beforeAll, describe, expect, it } from 'vitest'

import type { SparqlStore } from '../index.js'
import { getInitializedStore } from '../init.js'
import { buildTermIndex, resetTermIndex, type TermIndex } from '../schema-index/term-index.js'
import { extractSchemaVocabulary } from '../vocabulary-extractor.js'

let store: SparqlStore
let index: TermIndex

beforeAll(async () => {
  store = await getInitializedStore()
  index = await buildTermIndex(store)
}, 120_000)

describe('buildTermIndex — composition invariants', () => {
  it('covers every schema-vocabulary property as a (iri, domain) card', async () => {
    const vocab = await extractSchemaVocabulary(store)
    const cardKeys = new Set(
      index.cards.filter((c) => c.kind === 'property').map((c) => `${c.domain}|${c.iri}`)
    )

    for (const p of [...vocab.enumProperties, ...vocab.numericProperties]) {
      expect(cardKeys.has(`${p.domain}|${p.iri}`), `${p.domain}|${p.iri}`).toBe(true)
    }
  })

  it('carries sh:in enumerations and sh:name labels through to enum cards', async () => {
    const vocab = await extractSchemaVocabulary(store)
    const first = vocab.enumProperties[0]
    expect(first).toBeDefined()

    const card = index.cards.find(
      (c) => c.kind === 'property' && c.iri === first!.iri && c.domain === first!.domain
    )
    expect(card?.allowedValues).toEqual(first!.allowedValues)
    expect(card?.labels).toContain(first!.label)
    expect(card?.labels).toContain(card!.localName)
  })

  it('emits a class card for every domain with a target class', () => {
    const classCards = index.cards.filter((c) => c.kind === 'class')
    expect(classCards.length).toBeGreaterThan(0)
    for (const card of classCards) {
      expect(card.iri.length).toBeGreaterThan(0)
      expect(card.labels).toContain(card.domain)
    }
  })

  it('derives at least one cross-domain dependency edge (referencesDomain) from the schema alone', () => {
    const edges = index.cards.filter(
      (c) => c.kind === 'property' && c.referencesDomain && c.referencesDomain !== c.domain
    )
    expect(edges.length).toBeGreaterThan(0)
  })

  it('indexes the largest domain (gx) completely from the schema graph', () => {
    const gxCards = index.byDomain.get('gx') ?? []
    expect(gxCards.length).toBeGreaterThan(0)
  })
})

describe('buildTermIndex — catalog and caching', () => {
  it('produces one bounded domain-catalog entry per indexed domain', () => {
    expect(index.domainCatalog.map((d) => d.domain).sort()).toEqual(
      [...index.byDomain.keys()].sort()
    )
    for (const entry of index.domainCatalog) {
      expect(entry.classLabels.length).toBeGreaterThan(0)
      expect(entry.sampleTerms.length).toBeLessThanOrEqual(8)
    }
  })

  it('is deterministic: two builds over the same store yield identical cards', async () => {
    resetTermIndex()
    const rebuilt = await buildTermIndex(store)
    expect(rebuilt.cards).toEqual(index.cards)
  })

  it('single-flight caches per store and resets on demand', () => {
    const first = buildTermIndex(store)
    expect(buildTermIndex(store)).toBe(first)
    resetTermIndex()
    expect(buildTermIndex(store)).not.toBe(first)
  })

  it('never contains an empty-domain or unlabeled card', () => {
    for (const card of index.cards) {
      expect(card.domain.length).toBeGreaterThan(0)
      expect(card.labels.length).toBeGreaterThan(0)
      expect(card.labels).toContain(card.localName)
    }
  })
})
