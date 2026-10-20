/**
 * Projection contract: the autocomplete wire shape is derived from the
 * shared term index without changing what the web client sees.
 */
import { numericKind } from '@ontology-search/core/rdf/numeric-datatypes'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { beforeAll, describe, expect, it } from 'vitest'

import type { TermCard, TermIndex } from '../index.js'
import { getInitializedStore } from '../init.js'
import { buildTermIndex } from '../schema-index/term-index.js'
import { toVocabularyResponse } from '../schema-index/to-vocabulary-response.js'

const XSD = 'http://www.w3.org/2001/XMLSchema#'

function indexOf(
  cards: TermCard[],
  domains = [...new Set(cards.map((entry) => entry.domain))]
): TermIndex {
  return {
    cards,
    byDomain: new Map(),
    domainCatalog: domains.map((domain) => ({
      domain,
      classLabels: [domain],
      sampleTerms: [],
      propertyNames: [],
    })),
  }
}

const card = (overrides: Partial<TermCard>): TermCard => ({
  kind: 'property',
  iri: 'urn:x:p',
  localName: 'p',
  domain: 'alpha',
  labels: ['p'],
  leafKind: 'literal',
  ...overrides,
})

describe('toVocabularyResponse (pure projection)', () => {
  it('projects enum cards with their sh:in values', () => {
    const response = toVocabularyResponse(
      indexOf([
        card({
          localName: 'roadTypes',
          labels: ['road types', 'roadTypes'],
          description: 'Road categories',
          allowedValues: ['motorway', 'urban'],
        }),
      ])
    )

    expect(response.properties).toEqual([
      {
        name: 'roadTypes',
        label: 'road types',
        description: 'Road categories',
        domain: 'alpha',
        type: 'enum',
        allowedValues: ['motorway', 'urban'],
      },
    ])
    expect(response.domains).toEqual(['alpha'])
  })

  it('projects numeric cards, narrowing the datatype to the wire union', () => {
    const response = toVocabularyResponse(
      indexOf([
        card({ localName: 'lanes', datatype: `${XSD}integer` }),
        card({ localName: 'length', iri: 'urn:x:q', datatype: `${XSD}float` }),
      ])
    )

    expect(response.properties.map((p) => [p.name, p.type, p.datatype])).toEqual([
      ['lanes', 'numeric', 'integer'],
      ['length', 'numeric', 'float'],
    ])
  })

  it('projects free literals and drops object references and classes', () => {
    const response = toVocabularyResponse(
      indexOf([
        card({ localName: 'hasManifest', leafKind: 'iri', referencesDomain: 'manifest' }),
        card({ localName: 'title', labels: ['title'], datatype: `${XSD}string` }),
        card({ kind: 'class', localName: 'Asset', leafKind: undefined }),
      ])
    )
    expect(response.properties).toEqual([
      {
        name: 'title',
        label: 'title',
        description: '',
        domain: 'alpha',
        type: 'string',
      },
    ])
    expect(response.domains).toEqual(['alpha'])
  })

  it('retains catalog domains that have no projected properties', () => {
    const response = toVocabularyResponse(
      indexOf([card({ leafKind: 'iri', referencesDomain: 'beta' })], ['alpha', 'beta'])
    )
    expect(response.properties).toEqual([])
    expect(response.domains).toEqual(['alpha', 'beta'])
  })

  it('defaults the description and falls back to the local name as label', () => {
    const response = toVocabularyResponse(
      indexOf([card({ localName: 'zone', labels: [], allowedValues: ['a'] })])
    )
    expect(response.properties[0]).toMatchObject({ label: 'zone', description: '' })
  })
})

describe('toVocabularyResponse (contract parity with the schema vocabulary)', () => {
  let store: SparqlStore

  beforeAll(async () => {
    store = await getInitializedStore()
  }, 120_000)

  /**
   * Asserts properties of the projection rather than re-deriving it: the
   * previous version reimplemented `projectCard`'s classification with a
   * different precedence (leaf-kind filter first, values second), which
   * silently disagreed with production for closed enumerations whose
   * members are named individuals rather than literals.
   */
  it('covers every compiler literal path and every indexed domain', async () => {
    const index = await buildTermIndex(store)
    const response = toVocabularyResponse(index)

    const key = (domain: string, name: string): string => `${domain}|${name}`
    const projected = new Map(response.properties.map((p) => [key(p.domain, p.name), p]))
    const propertyCards = index.cards.filter((entry) => entry.kind === 'property')

    // Nothing is invented: every projected property is an indexed card.
    const cardKeys = new Set(propertyCards.map((c) => key(c.domain, c.localName)))
    expect([...projected.keys()].filter((k) => !cardKeys.has(k))).toEqual([])

    // Nothing filterable is silently dropped. A card is filterable if it
    // enumerates values (a closed `sh:in` list is a filter whether its
    // members are literals or named individuals) or is a literal leaf.
    const filterable = propertyCards.filter(
      (c) => (c.allowedValues && c.allowedValues.length > 0) || c.leafKind === 'literal'
    )
    expect(
      filterable.filter((c) => !projected.has(key(c.domain, c.localName))).map((c) => c.iri)
    ).toEqual([])

    // Enumerated cards project as enums carrying exactly the indexed values;
    // an unenumerated numeric leaf projects as numeric, any other literal
    // leaf as string, and unenumerated object references do not project at
    // all (they are represented by the recursive `references` field).
    for (const card of propertyCards) {
      const entry = projected.get(key(card.domain, card.localName))
      if (card.allowedValues && card.allowedValues.length > 0) {
        expect(entry?.type, card.iri).toBe('enum')
        // Same values, same order — the response is the index, not a
        // re-derivation of it.
        if (entry?.type === 'enum')
          expect(entry.allowedValues, card.iri).toEqual(card.allowedValues)
      } else if (numericKind(card.datatype) !== null) {
        expect(entry?.type, card.iri).toBe('numeric')
      } else if (card.leafKind === 'literal') {
        expect(entry?.type, card.iri).toBe('string')
      } else {
        expect(entry, card.iri).toBeUndefined()
      }
    }

    // All four classifications are actually exercised by the corpus, so a
    // future projection change cannot pass by emitting only one of them.
    const types = new Set(response.properties.map((p) => p.type))
    expect([...types].sort()).toEqual(['enum', 'numeric', 'string'])

    expect(response.domains).toEqual(index.domainCatalog.map((entry) => entry.domain))
  })
})
