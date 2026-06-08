import { describe, expect, it } from 'vitest'

import { extractDomain, extractLocalName } from '../iri.js'

describe('extractLocalName', () => {
  it('extracts fragment from hash IRI', () => {
    expect(extractLocalName('http://example.org/ontology#HdMap')).toBe('HdMap')
  })

  it('extracts last segment from slash IRI', () => {
    expect(extractLocalName('https://w3id.org/ascs-ev/envited-x/hdmap/v6/hasFormat')).toBe(
      'hasFormat'
    )
  })

  it('prefers hash over slash when both present', () => {
    expect(extractLocalName('http://example.org/path/to#Fragment')).toBe('Fragment')
  })

  it('returns full string when no separator present', () => {
    expect(extractLocalName('plainValue')).toBe('plainValue')
  })
})

describe('extractDomain', () => {
  it('extracts domain from versioned namespace IRI', () => {
    expect(extractDomain('https://w3id.org/ascs-ev/envited-x/hdmap/v6/HdMap')).toBe('hdmap')
  })

  it('returns empty string for non-matching IRI', () => {
    expect(extractDomain('http://www.w3.org/2000/01/rdf-schema#subClassOf')).toBe('')
  })

  it('uses resolver function when provided', () => {
    const resolver = (iri: string) => (iri.includes('hdmap') ? 'hdmap' : undefined)
    expect(extractDomain('https://w3id.org/ascs-ev/envited-x/hdmap/v6/HdMap', resolver)).toBe(
      'hdmap'
    )
  })

  it('returns empty when resolver returns undefined (no path fallback)', () => {
    const resolver = () => undefined
    expect(extractDomain('https://example.org/scenario/v2/Scenario', resolver)).toBe('')
  })
})
