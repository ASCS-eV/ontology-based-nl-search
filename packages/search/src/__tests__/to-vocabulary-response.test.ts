/**
 * Projection contract: the autocomplete wire shape is derived from the
 * shared term index without changing what the web client sees.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import type { SparqlStore, TermCard, TermIndex } from '../index.js'
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
    domainCatalog: domains.map((domain) => ({ domain, classLabels: [domain], sampleTerms: [] })),
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

  it('covers every compiler literal path and every indexed domain', async () => {
    const index = await buildTermIndex(store)
    const response = toVocabularyResponse(index)

    const projected = new Set(response.properties.map((p) => `${p.domain}|${p.name}|${p.type}`))
    const declared = new Set(
      index.cards
        .filter((entry) => entry.kind === 'property' && entry.leafKind === 'literal')
        .map((entry) => {
          const type =
            entry.allowedValues && entry.allowedValues.length > 0
              ? 'enum'
              : entry.datatype === `${XSD}integer` || entry.datatype === `${XSD}float`
                ? 'numeric'
                : 'string'
          return `${entry.domain}|${entry.localName}|${type}`
        })
    )

    expect(projected).toEqual(declared)
    expect(response.domains).toEqual(index.domainCatalog.map((entry) => entry.domain))
  })
})
