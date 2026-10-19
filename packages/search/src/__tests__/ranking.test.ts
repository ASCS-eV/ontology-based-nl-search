/**
 * Pure ranking unit tests — fully deterministic, no I/O.
 * Fixtures use synthetic vocabulary; nothing here names a real ontology.
 */
import { describe, expect, it } from 'vitest'

import {
  lexicalScore,
  namedDomains,
  rankCards,
  rankDomains,
  tokenize,
} from '../schema-index/ranking.js'
import type { DomainCard, TermCard } from '../schema-index/term-index.js'

const card = (overrides: Partial<TermCard>): TermCard => ({
  kind: 'property',
  iri: 'https://example.org/alpha/speedLimit',
  localName: 'speedLimit',
  domain: 'alpha',
  labels: ['speed limit', 'speedLimit'],
  ...overrides,
})

describe('tokenize', () => {
  it('splits camelCase identifiers and lowercases', () => {
    expect(tokenize('speedLimit')).toEqual(['speed', 'limit'])
  })

  it('drops function words and single characters', () => {
    expect(tokenize('roads with a limit of 50')).toEqual(['roads', 'limit', '50'])
  })
})

describe('lexicalScore', () => {
  it('scores an exact label-token match highest', () => {
    expect(lexicalScore('speed', card({}))).toBe(1)
  })

  it('weights labels above enum values above descriptions', () => {
    const labelHit = lexicalScore('speed', card({}))
    const valueHit = lexicalScore(
      'motorway',
      card({ allowedValues: ['motorway', 'rural'], labels: ['road types'] })
    )
    const descriptionHit = lexicalScore(
      'permitted',
      card({ description: 'maximum permitted velocity', labels: ['velocity'] })
    )
    expect(labelHit).toBeGreaterThan(valueHit)
    expect(valueHit).toBeGreaterThan(descriptionHit)
    expect(descriptionHit).toBeGreaterThan(0)
  })

  it('matches misspellings via trigram similarity, weaker than exact', () => {
    const typo = lexicalScore('motorwy', card({ allowedValues: ['motorway'], labels: ['roads'] }))
    const exact = lexicalScore('motorway', card({ allowedValues: ['motorway'], labels: ['roads'] }))
    expect(typo).toBeGreaterThan(0)
    expect(typo).toBeLessThan(exact)
  })

  it('gives zero signal for unrelated queries', () => {
    expect(lexicalScore('quantum flux capacitor', card({}))).toBe(0)
  })
})

describe('rankCards', () => {
  const cards = [
    card({ iri: 'https://example.org/alpha/b', localName: 'width', labels: ['width'] }),
    card({ iri: 'https://example.org/alpha/a', localName: 'speedLimit' }),
    card({
      iri: 'https://example.org/beta/c',
      domain: 'beta',
      localName: 'speed',
      labels: ['speed'],
    }),
  ]

  it('ranks by score, breaking ties deterministically by (domain, iri), dropping zero scores', () => {
    const ranked = rankCards('speed', cards)
    // 'width' has no signal for 'speed' and is filtered; the two exact
    // matches tie on score and break by domain name (alpha < beta).
    expect(ranked.map((s) => s.card.iri)).toEqual([
      'https://example.org/alpha/a',
      'https://example.org/beta/c',
    ])
    // Identical inputs always produce identical output.
    expect(rankCards('speed', cards)).toEqual(ranked)
  })

  it('filters non-matching cards via minScore', () => {
    const ranked = rankCards('speed', cards, { minScore: 0.5 })
    expect(ranked.every((s) => s.score > 0.5)).toBe(true)
    expect(ranked.find((s) => s.card.localName === 'width')).toBeUndefined()
  })
})

describe('rankDomains', () => {
  const catalog: DomainCard[] = [
    { domain: 'roadmaps', classLabels: ['Road Map Asset'], sampleTerms: ['speedLimit', 'lanes'] },
    { domain: 'weather', classLabels: ['Weather Recording'], sampleTerms: ['temperature'] },
  ]

  it('routes by class label and sample terms', () => {
    expect(rankDomains('road map', catalog)[0]?.domain.domain).toBe('roadmaps')
    expect(rankDomains('temperature recording', catalog)[0]?.domain.domain).toBe('weather')
  })

  it('returns nothing for signal-free queries', () => {
    expect(rankDomains('xyzzy plugh', catalog)).toEqual([])
  })
})

describe('identifier code-list damping', () => {
  /**
   * Regression: a card with thousands of enum values (media types) fuzzy-
   * matched most words of any query and outranked every relevant card,
   * pulling its domain into routing.
   */
  it('ranks a concept card above a huge code list that only fuzzy-matches', () => {
    const query = 'open system approaches car'
    const codeList = card({
      domain: 'meta',
      iri: 'https://example.org/meta/mediaTypes',
      labels: ['media types'],
      allowedValues: [
        'application/opendocument',
        'application/systems',
        'application/approach',
        'model/cartomobile',
        ...Array.from({ length: 2000 }, (_, i) => `application/x-${i}`),
      ],
    })
    const concept = card({
      iri: 'https://example.org/alpha/vehicle',
      labels: ['road user vehicle'],
      allowedValues: ['car', 'truck', 'bus'],
    })
    const ranked = rankCards(query, [codeList, concept])
    expect(ranked[0]!.card.iri).toBe(concept.iri)
  })

  it('leaves the value weight of a normal-sized enum untouched', () => {
    const small = card({ labels: ['road types'], allowedValues: ['motorway', 'rural'] })
    expect(lexicalScore('motorway', small)).toBeCloseTo(0.7)
  })
})

describe('namedDomains', () => {
  const domains = ['alpha-beta', 'gamma', 'gammadelta', 'hdmap']

  it('matches a product-style name without splitting it on camelCase', () => {
    expect(namedDomains('Gamma only: something', domains)).toEqual(['gamma'])
  })

  it('matches a hyphenated id written as two words or joined', () => {
    expect(namedDomains('find alpha beta assets', domains)).toEqual(['alpha-beta'])
    expect(namedDomains('find AlphaBeta assets', domains)).toEqual(['alpha-beta'])
    expect(namedDomains('find alpha-beta assets', domains)).toEqual(['alpha-beta'])
    expect(namedDomains('hd map with lanes', domains)).toEqual(['hdmap'])
  })

  it('keeps only the longer id when one named id prefixes another', () => {
    expect(namedDomains('gamma delta tags', domains)).toEqual(['gammadelta'])
  })

  it('returns domains in query order and nothing for unnamed domains', () => {
    expect(namedDomains('hdmap and gamma', domains)).toEqual(['hdmap', 'gamma'])
    expect(namedDomains('motorway at night', domains)).toEqual([])
  })
})
