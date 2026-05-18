/**
 * Pin the shape of the prefix map and the helper output. These tests
 * guard the contract every caller in the codebase relies on:
 *
 * - Every standard W3C / SKOS prefix the project uses is present.
 * - `gx` (GAIA-X development) is layered on top of the community list.
 * - SPARQL-line helpers produce the exact format the policy parser
 *   and the compiler-determinism snapshot suite expect.
 */

import { describe, expect, it } from 'vitest'

import { iri, RDF_PREFIXES, sparqlPrefix, sparqlPrefixes } from '../prefixes.js'

describe('RDF_PREFIXES — community list + custom layer', () => {
  it('exposes every W3C prefix the project uses', () => {
    expect(RDF_PREFIXES.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
    expect(RDF_PREFIXES.rdfs).toBe('http://www.w3.org/2000/01/rdf-schema#')
    expect(RDF_PREFIXES.xsd).toBe('http://www.w3.org/2001/XMLSchema#')
    expect(RDF_PREFIXES.owl).toBe('http://www.w3.org/2002/07/owl#')
    expect(RDF_PREFIXES.sh).toBe('http://www.w3.org/ns/shacl#')
    expect(RDF_PREFIXES.skos).toBe('http://www.w3.org/2004/02/skos/core#')
  })

  it('layers project-specific gx prefix on top of the community list', () => {
    expect(RDF_PREFIXES.gx).toBe('https://w3id.org/gaia-x/development#')
  })
})

describe('sparqlPrefix', () => {
  it('formats a single PREFIX declaration', () => {
    expect(sparqlPrefix('sh')).toBe('PREFIX sh: <http://www.w3.org/ns/shacl#>')
    expect(sparqlPrefix('xsd')).toBe('PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>')
  })
})

describe('sparqlPrefixes', () => {
  it('joins multiple declarations with newlines, preserving order', () => {
    expect(sparqlPrefixes('sh', 'rdfs')).toBe(
      'PREFIX sh: <http://www.w3.org/ns/shacl#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>'
    )
  })

  it('returns an empty string when called with no arguments', () => {
    expect(sparqlPrefixes()).toBe('')
  })
})

describe('iri', () => {
  it('concatenates a known prefix IRI with a local name', () => {
    expect(iri('xsd', 'string')).toBe('http://www.w3.org/2001/XMLSchema#string')
    expect(iri('skos', 'broaderTransitive')).toBe(
      'http://www.w3.org/2004/02/skos/core#broaderTransitive'
    )
  })
})
