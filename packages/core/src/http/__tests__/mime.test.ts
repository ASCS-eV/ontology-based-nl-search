/**
 * Pin the MIME type wire contract. The SPARQL stores and ontology I/O
 * paths all read from this map; tests guard the exact strings.
 */

import { describe, expect, it } from 'vitest'

import { MIME, type MimeType } from '../mime.js'

describe('MIME', () => {
  it('exposes IETF/W3C SPARQL and RDF media types', () => {
    expect(MIME).toEqual({
      SPARQL_QUERY: 'application/sparql-query',
      SPARQL_UPDATE: 'application/sparql-update',
      SPARQL_RESULTS_JSON: 'application/sparql-results+json',
      TURTLE: 'text/turtle',
      JSONLD: 'application/ld+json',
    })
  })

  it('has a type that admits every value', () => {
    const values: MimeType[] = Object.values(MIME)
    expect(values).toHaveLength(5)
  })
})
