/**
 * Pure ranking unit tests — fully deterministic, no I/O.
 * Fixtures use synthetic vocabulary; nothing here names a real ontology.
 */
import { describe, expect, it } from 'vitest'

import {
  corpusStats,
  lexicalScore,
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
    {
      domain: 'roadmaps',
      classLabels: ['Road Map Asset'],
      sampleTerms: ['speedLimit', 'lanes'],
      propertyNames: ['speedLimit', 'lanes'],
    },
    {
      domain: 'weather',
      classLabels: ['Weather Recording'],
      sampleTerms: ['temperature'],
      propertyNames: ['temperature'],
    },
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
   *
   * Damping is corpus-relative (BM25 pivoted length normalization), so the
   * fixture is a realistic corpus — mostly small vocabularies plus one
   * sponge — rather than the sponge alone, which would be its own average.
   */
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
  const ordinary = Array.from({ length: 12 }, (_, i) =>
    card({
      iri: `https://example.org/alpha/p${i}`,
      localName: `p${i}`,
      labels: [`property ${i}`],
      allowedValues: ['first', 'second', 'third'],
    })
  )

  it('ranks a concept card above a huge code list that only fuzzy-matches', () => {
    const ranked = rankCards('open system approaches car', [codeList, concept, ...ordinary])
    expect(ranked[0]!.card.iri).toBe(concept.iri)
  })

  it('leaves the value weight of a normal-sized enum untouched', () => {
    const small = card({ labels: ['road types'], allowedValues: ['motorway', 'rural'] })
    expect(lexicalScore('motorway', small)).toBeCloseTo(0.7)
    expect(lexicalScore('motorway', small, corpusStats([small, ...ordinary]))).toBeCloseTo(0.7)
  })

  /**
   * The damping must come from the corpus, not from an absolute size
   * threshold: on an ontology set where EVERY vocabulary is large, size
   * carries no signal and a fixed cutoff would wrongly damp all of them.
   */
  it('damps nothing when every vocabulary in the corpus is large', () => {
    const big = (domain: string, extra: string[]): TermCard =>
      card({
        domain,
        iri: `https://example.org/${domain}/codes`,
        labels: [`${domain} codes`],
        allowedValues: [...extra, ...Array.from({ length: 2000 }, (_, i) => `code-${domain}-${i}`)],
      })
    const corpus = [big('alpha', ['motorway']), big('beta', []), big('gamma', [])]
    expect(lexicalScore('motorway', corpus[0]!, corpusStats(corpus))).toBeCloseTo(0.7)
  })

  it('reports the mean value-token count only over cards that enumerate values', () => {
    const enumerated = card({ allowedValues: ['one', 'two', 'three', 'four'] })
    const plain = card({ iri: 'https://example.org/alpha/plain', localName: 'plain' })
    expect(corpusStats([enumerated, plain]).avgValueTokens).toBe(4)
    expect(corpusStats([plain]).avgValueTokens).toBe(0)
  })
})

describe('joined-token routing', () => {
  /**
   * Regression: `tokenize` splits camelCase, so a product name written as
   * one word ("OpenLABEL") normalizes to two tokens while the ontology's
   * own id stays one. Without span joining an explicitly named domain only
   * scored a weak prefix match, and a versioned sibling could not be told
   * apart from its base at all.
   */
  const catalog: DomainCard[] = [
    {
      domain: 'gammalabel',
      classLabels: ['Base Tag'],
      sampleTerms: ['tagValue'],
      propertyNames: ['tagValue'],
    },
    {
      domain: 'gammalabel-v2',
      classLabels: ['Scenario'],
      sampleTerms: ['motionStop'],
      propertyNames: ['motionStop'],
    },
    {
      domain: 'roadgraph',
      classLabels: ['Map Asset'],
      sampleTerms: ['lanes'],
      propertyNames: ['lanes'],
    },
    {
      domain: 'weather',
      classLabels: ['Weather Recording'],
      sampleTerms: ['temperature'],
      propertyNames: ['temperature'],
    },
    {
      domain: 'carpet',
      classLabels: ['Floor Covering'],
      sampleTerms: ['pileHeight'],
      propertyNames: ['pileHeight'],
    },
  ]
  const scores = (query: string): Map<string, number> =>
    new Map(rankDomains(query, catalog).map((s) => [s.domain.domain, s.score]))

  it('matches an id written as adjacent words', () => {
    // The contract is the score, not just the order: without span joining
    // `graph` matches nothing in `roadgraph` and the query scores strictly
    // lower, whatever the rest of the catalog happens to do.
    const unjoined = scores('road, graph with lanes').get('roadgraph') ?? 0
    expect(scores('road graph with lanes').get('roadgraph') ?? 0).toBeGreaterThan(unjoined)
    expect(rankDomains('road graph with lanes', catalog)[0]?.domain.domain).toBe('roadgraph')
  })

  it('prefers the versioned sibling the query names over its base id', () => {
    for (const query of ['GammaLabel v2 scenarios', 'gamma label v2 scenarios']) {
      const ranked = scores(query)
      expect(ranked.get('gammalabel-v2')).toBeGreaterThan(ranked.get('gammalabel') ?? 0)
    }
    // Only the joined span can read `label` as part of the id, so dividing
    // the two words strictly lowers the score it would otherwise reach.
    expect(scores('gamma label v2 scenarios').get('gammalabel-v2') ?? 0).toBeGreaterThan(
      scores('gamma, label v2 scenarios').get('gammalabel-v2') ?? 0
    )
  })

  it('routes identically however the user capitalizes a product name', () => {
    // The per-token mean differs with the token count ("GammaLabel" is two
    // tokens, "gammalabel" one), so the cross-spelling contract is the
    // routing order. The score contract is between the two *split*
    // spellings: the camelCase cut is this tokenizer's own, so rejoining it
    // is worth strictly more than guessing that two written words are one.
    const order = (query: string): string[] =>
      rankDomains(query, catalog).map((s) => s.domain.domain)
    expect(order('GammaLabel motion stop')).toEqual(order('gammalabel motion stop'))
    expect(order('GammaLabel motion stop')[0]).toBe('gammalabel-v2')
    expect(scores('GammaLabel motion stop').get('gammalabel-v2') ?? 0).toBeGreaterThan(
      scores('gamma label motion stop').get('gammalabel-v2') ?? 0
    )
  })

  it('joins nothing for ordinary prose', () => {
    expect(rankDomains('xyzzy plugh', catalog)).toEqual([])
    expect(scores('temperature recording').get('weather')).toBeGreaterThan(0)
  })

  /**
   * Regression: tokenization drops function words, so without recording
   * adjacency *before* dropping them the gap would close up and two
   * unrelated words would concatenate into a domain id the user never
   * wrote. "road and graph data" must not match `roadgraph`.
   */
  it('never joins across a dropped function word', () => {
    const exact = scores('roadgraph').get('roadgraph') ?? 0
    const adjacent = scores('road graph data').get('roadgraph') ?? 0
    const bridged = scores('road and graph data').get('roadgraph') ?? 0
    expect(adjacent).toBeGreaterThan(bridged)
    expect(bridged).toBeLessThan(exact)
  })

  /**
   * Regression: a span is credited at the weakest seam it crosses. The
   * three grades, and the strict ordering between them, are the whole
   * contract — binary adjacency collapses the first two, and no joining at
   * all collapses the last two.
   */
  it('grades a join by the seam it crosses', () => {
    const exact = scores('roadgraph').get('roadgraph') ?? 0
    const divided = scores('road, graph').get('roadgraph') ?? 0
    for (const query of ['road-graph', 'road_graph']) {
      expect(scores(query).get('roadgraph')).toBe(exact)
    }
    for (const query of ['road graph', 'road  graph']) {
      const guessed = scores(query).get('roadgraph') ?? 0
      expect(guessed).toBeLessThan(exact)
      expect(guessed).toBeGreaterThan(divided)
    }
    for (const query of ['road/graph', 'road; graph']) {
      expect(scores(query).get('roadgraph') ?? 0).toBe(divided)
    }
  })

  /**
   * Regression: the bigger the ontology, the more compound identifiers it
   * has, so adjacent word pairs concatenate into one by accident. Crediting
   * that as *exact* lets an unrelated domain tie or outrank the one the
   * user named; crediting it as an approximation keeps the recall without
   * the false certainty. Precision must not decay as the ontology grows.
   */
  it('never claims an exact match for two words the user wrote apart', () => {
    expect(scores('car pet').get('carpet') ?? 0).toBeLessThan(scores('carpet').get('carpet') ?? 0)
  })
})

describe('rankDomains tie-breaking', () => {
  /**
   * Regression: two domains can score identically because one is *named* by
   * the query word and the other merely *contains* it as a class label. The
   * named one is what the user asked for, so it must win — and it must win
   * even when the alphabetical fallback would have put the other first,
   * which is the only arrangement that detects a missing name tiebreak.
   */
  it('prefers the domain the query names when total scores tie', () => {
    const catalog: DomainCard[] = [
      {
        domain: 'alpha',
        classLabels: ['Weather'],
        sampleTerms: ['xylophone'],
        propertyNames: ['xylophone'],
      },
      {
        domain: 'weather',
        classLabels: ['Beta'],
        sampleTerms: ['zeppelin'],
        propertyNames: ['zeppelin'],
      },
    ]
    const ranked = rankDomains('weather', catalog)
    expect(ranked[0]?.score).toBe(ranked[1]?.score)
    expect(ranked[0]?.domain.domain).toBe('weather')
    expect(ranked[1]?.nameScore).toBe(0)
  })
})
