/**
 * Regression tests for the domain tie-break.
 *
 * The reported failure: "maps in france and other european countries with
 * autobahn" answered from both domains that declare `roadTypes`, so a query
 * that named its subject outright returned assets of a kind the user had just
 * ruled out.
 *
 * The rule under test is narrow on purpose — it may only pick between domains
 * that were already candidates, and only when the query names one of them
 * clearly. Half of these cases are about it declining to act.
 */
import { describe, expect, it } from 'vitest'

import {
  domainTokens,
  preferDomainsNamedInQuery,
  scoreDomainAgainstQuery,
  tokenize,
} from '../domain-preference.js'

describe('tokenize', () => {
  it('folds case, punctuation and the plural s', () => {
    expect(tokenize('Maps, in France!')).toEqual(new Set(['maps', 'map', 'france']))
  })

  it('drops fragments too short to be evidence', () => {
    expect(tokenize('a in of my')).toEqual(new Set([]))
  })
})

describe('domainTokens', () => {
  it('keeps the whole name and its separated parts', () => {
    expect(domainTokens('environment-model')).toEqual(
      new Set(['environment-model', 'environment', 'model'])
    )
    expect(domainTokens('surfaceModel')).toEqual(new Set(['surfacemodel', 'surface', 'model']))
  })

  it('leaves an all-lowercase compound whole', () => {
    // Nothing marks the boundary in "hdmap"; the substring rule reaches it.
    expect(domainTokens('hdmap')).toEqual(new Set(['hdmap']))
  })
})

describe('scoreDomainAgainstQuery', () => {
  it('scores a domain the query names outright above one it merely contains', () => {
    const tokens = tokenize('scenario maps')
    expect(scoreDomainAgainstQuery('scenario', tokens)).toBeGreaterThan(
      scoreDomainAgainstQuery('hdmap', tokens)
    )
  })

  it('scores a domain the query never mentions at zero', () => {
    expect(scoreDomainAgainstQuery('ositrace', tokenize('maps in france'))).toBe(0)
  })
})

describe('preferDomainsNamedInQuery', () => {
  it('answers the reported case: "maps …" keeps only the map domain', () => {
    expect(
      preferDomainsNamedInQuery(
        ['hdmap', 'ositrace'],
        'maps in france and other european countries with autobahn'
      )
    ).toEqual(['hdmap'])
  })

  it('works the other way round — naming traces keeps the trace domain', () => {
    // The rule is about the query naming its subject, not about which domain
    // it is; an ontology with different names gets the same treatment.
    expect(preferDomainsNamedInQuery(['hdmap', 'ositrace'], 'ositrace recordings')).toEqual([
      'ositrace',
    ])
  })

  it('keeps both when the query names neither', () => {
    const domains = ['hdmap', 'ositrace']
    expect(preferDomainsNamedInQuery(domains, 'assets in germany with three lanes')).toEqual(
      domains
    )
  })

  it('keeps both when the query names both', () => {
    const domains = ['scenario', 'hdmap']
    expect(preferDomainsNamedInQuery(domains, 'scenario maps')).toEqual(domains)
  })

  it('never introduces a domain that was not a candidate', () => {
    expect(preferDomainsNamedInQuery(['ositrace'], 'maps of germany')).toEqual(['ositrace'])
    expect(preferDomainsNamedInQuery([], 'maps')).toEqual([])
  })

  it('passes an empty or wordless query straight through', () => {
    const domains = ['hdmap', 'ositrace']
    expect(preferDomainsNamedInQuery(domains, '')).toEqual(domains)
    expect(preferDomainsNamedInQuery(domains, '?? 12 !')).toEqual(domains)
  })
})
