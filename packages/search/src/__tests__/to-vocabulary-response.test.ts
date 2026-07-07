/**
 * Projection contract: the autocomplete wire shape is derived from the
 * shared term index without changing what the web client sees.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import type { SparqlStore, TermCard, TermIndex } from '../index.js'
import { getInitializedStore } from '../init.js'
import { buildTermIndex } from '../schema-index/term-index.js'
import { toVocabularyResponse } from '../schema-index/to-vocabulary-response.js'
import { extractSchemaVocabulary } from '../vocabulary-extractor.js'

const XSD = 'http://www.w3.org/2001/XMLSchema#'

function indexOf(cards: TermCard[]): TermIndex {
  return { cards, byDomain: new Map(), domainCatalog: [] }
}

const card = (overrides: Partial<TermCard>): TermCard => ({
  kind: 'property',
  iri: 'urn:x:p',
  localName: 'p',
  domain: 'alpha',
  labels: ['p'],
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

  it('drops cards with no autocomplete representation (object refs, free literals, classes)', () => {
    const response = toVocabularyResponse(
      indexOf([
        card({ localName: 'hasManifest', referencesDomain: 'manifest' }),
        card({ localName: 'title', datatype: `${XSD}string` }),
        card({ kind: 'class', localName: 'Asset' }),
      ])
    )
    expect(response.properties).toEqual([])
    expect(response.domains).toEqual([])
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

  it('covers exactly the enum + numeric properties the schema vocabulary declares', async () => {
    const [index, vocab] = await Promise.all([
      buildTermIndex(store),
      extractSchemaVocabulary(store),
    ])
    const response = toVocabularyResponse(index)

    const projected = new Set(response.properties.map((p) => `${p.domain}|${p.name}|${p.type}`))
    const declared = new Set([
      ...vocab.enumProperties.map((p) => `${p.domain}|${p.localName}|enum`),
      ...vocab.numericProperties.map((p) => `${p.domain}|${p.localName}|numeric`),
    ])

    expect(projected).toEqual(declared)
    expect([...response.domains].sort()).toEqual([...vocab.domains].sort())
  })
})
