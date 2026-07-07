/**
 * Pure ranking unit tests (issue #125) — fully deterministic, no I/O.
 * Fixtures use synthetic vocabulary; nothing here names a real ontology.
 */
import { describe, expect, it } from 'vitest'

import { lexicalScore, rankCards, rankDomains, tokenize } from '../schema-index/ranking.js'
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
