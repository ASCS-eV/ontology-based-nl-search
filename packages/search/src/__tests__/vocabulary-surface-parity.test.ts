/**
 * Cross-surface parity between the two consumers of the compiler vocabulary.
 *
 * The term index (prompt retrieval / autocomplete) and `extractSchemaVocabulary`
 * (slot validation) both enumerate "every property the compiler can resolve".
 * They are separate code paths, and they drifted: the index read the asset
 * paths UNION the standalone vocabulary roots, while the extractor read the
 * asset paths alone. Domains published only as standalone vocabularies then
 * reached the LLM with ZERO filterable values — the model could not map any
 * term onto them and reported every one of their properties as an ontology
 * gap.
 *
 * `allPropertyPaths` is now the single accessor both read. These tests pin
 * that they cannot diverge again, and are ontology-agnostic: nothing here
 * names a domain, a property, or a namespace.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { getCompilerVocab } from '../compiler.js'
import { allPropertyPaths } from '../compiler-vocab.js'
import { getInitializedStore } from '../init.js'
import type { TermIndex } from '../schema-index/term-index.js'
import { buildTermIndex } from '../schema-index/term-index.js'
import type { SchemaVocabulary } from '../vocabulary-extractor.js'
import { extractSchemaVocabulary, resetVocabulary } from '../vocabulary-extractor.js'

let index: TermIndex
let vocabulary: SchemaVocabulary

beforeAll(async () => {
  const store = await getInitializedStore()
  resetVocabulary()
  index = await buildTermIndex(store)
  vocabulary = await extractSchemaVocabulary(store)
}, 180_000)

describe('allPropertyPaths', () => {
  it('includes the standalone vocabulary roots, not just the asset-rooted paths', async () => {
    const vocab = await getCompilerVocab()
    const all = allPropertyPaths(vocab)

    expect(all.length).toBeGreaterThanOrEqual(vocab.paths.size)
    const rootCount = [...(vocab.vocabularyRoots?.values() ?? [])]
      .flat()
      .reduce((sum, entry) => sum + entry.paths.size, 0)
    expect(all.length).toBe(vocab.paths.size + rootCount)
  })

  it('attributes a domain to properties reachable only through a vocabulary root', async () => {
    const vocab = await getCompilerVocab()
    const assetDomains = new Set(
      [...vocab.paths.values()].map((path) => path.domain).filter(Boolean)
    )
    const allDomains = new Set(
      allPropertyPaths(vocab)
        .map((path) => path.domain)
        .filter(Boolean)
    )

    // Every asset domain survives the union.
    for (const domain of assetDomains) expect(allDomains.has(domain)).toBe(true)

    // And the union is strictly larger: at least one domain is published
    // only as a standalone vocabulary. That is precisely the set the old
    // asset-paths-only read dropped, so if this is ever empty the parity
    // tests below stop proving anything and must be re-grounded.
    const rootOnly = [...allDomains].filter((domain) => !assetDomains.has(domain))
    expect(rootOnly.length).toBeGreaterThan(0)
  })
})

describe('enum coverage parity across retrieval and validation', () => {
  /**
   * The regression itself: a domain whose cards expose `sh:in` values in the
   * term index must also expose them in the validation vocabulary. Before
   * the shared accessor, whole domains satisfied the first and failed the
   * second.
   */
  it('exposes enum values for the same domains on both surfaces', () => {
    const indexDomains = new Set(
      index.cards
        .filter((card) => card.kind === 'property' && (card.allowedValues?.length ?? 0) > 0)
        .map((card) => card.domain)
    )
    const vocabularyDomains = new Set(
      vocabulary.enumProperties
        .filter((property) => property.allowedValues.length > 0)
        .map((property) => property.domain)
    )

    expect(indexDomains.size).toBeGreaterThan(0)
    const missing = [...indexDomains].filter((domain) => !vocabularyDomains.has(domain)).sort()
    expect(missing).toEqual([])
  })

  /**
   * Stronger, same direction: parity holds per property, not just per
   * domain. A property the index offers values for but the validator does
   * not know is a value the LLM will propose and the validator will reject.
   */
  it('exposes the same enum properties on both surfaces', () => {
    const key = (domain: string, iri: string): string => `${domain}|${iri}`
    const indexed = index.cards
      .filter((card) => card.kind === 'property' && (card.allowedValues?.length ?? 0) > 0)
      .map((card) => key(card.domain, card.iri))
    const known = new Set(
      vocabulary.enumProperties
        .filter((property) => property.allowedValues.length > 0)
        .map((property) => key(property.domain, property.iri))
    )

    expect(indexed.length).toBeGreaterThan(0)
    expect([...new Set(indexed)].filter((entry) => !known.has(entry)).sort()).toEqual([])
  })

  /**
   * Parity of the values themselves, not just of the property names. The
   * index showing the LLM a value the validator does not accept is the same
   * failure one level down: the model proposes it and the filter is dropped.
   */
  it('offers no indexed value the validator would reject', () => {
    const known = new Map(
      vocabulary.enumProperties.map((property) => [
        `${property.domain}|${property.iri}`,
        new Set(property.allowedValues),
      ])
    )
    const unknown: string[] = []
    for (const card of index.cards) {
      if (card.kind !== 'property') continue
      const accepted = known.get(`${card.domain}|${card.iri}`)
      if (!accepted) continue
      for (const value of card.allowedValues ?? []) {
        if (!accepted.has(value)) unknown.push(`${card.domain}|${card.localName}|${value}`)
      }
    }
    expect(known.size).toBeGreaterThan(0)
    expect(unknown.sort().slice(0, 20)).toEqual([])
  })
})
