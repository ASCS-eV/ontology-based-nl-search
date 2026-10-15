import { describe, expect, it } from 'vitest'

import { compactIri } from '../iri'

describe('compactIri', () => {
  it('reduces an absolute IRI to its local name (slash or hash)', () => {
    expect(compactIri('https://example.org/ontologies/MotorwayManaged')).toBe('MotorwayManaged')
    expect(compactIri('http://example.org/vocab#RoadType')).toBe('RoadType')
  })

  it('compacts every IRI inside surrounding text', () => {
    expect(compactIri('https://a.example/x/One, https://b.example/y#Two')).toBe('One, Two')
  })

  it('leaves plain words, prefixed names and DIDs untouched', () => {
    for (const v of ['motorway', 'DE', 'ex:Thing', 'did:web:example.org:Tag:1', 'true']) {
      expect(compactIri(v)).toBe(v)
    }
  })

  it('keeps an IRI whose local name would be empty', () => {
    expect(compactIri('https://example.org/ns/')).toBe('https://example.org/ns/')
  })
})
