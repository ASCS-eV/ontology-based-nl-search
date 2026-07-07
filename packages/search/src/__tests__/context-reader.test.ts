/**
 * Context-reader tests against the real artifact tree (issue #122).
 *
 * The two fixture domains exercise the two context dialects that exist in
 * the wild ([JSON-LD11] context processing):
 *  - `gx` — LinkML-generated: `@vocab`, bare `@id`s resolved against it,
 *    scoped (nested) contexts, keyword aliases (`"meaning": "@id"`).
 *  - `georeference` — `context_generator.py`-generated: no `@vocab`, flat
 *    compact-IRI mappings with explicit `@type` coercions.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  readContextTerms,
  readContextTermsForDomain,
  resetContextTerms,
} from '../schema-index/context-reader.js'

const XSD = 'http://www.w3.org/2001/XMLSchema#'
const GX_VOCAB = 'https://w3id.org/gaia-x/development#'

beforeEach(() => {
  resetContextTerms()
})

describe('readContextTerms (real artifact tree)', () => {
  it('discovers a lexicon covering every domain that ships a context file', () => {
    const terms = readContextTerms()
    const domains = new Set(terms.map((t) => t.domain))

    // The artifact tree ships one context per domain; both dialects must load.
    expect(domains.has('gx')).toBe(true)
    expect(domains.has('georeference')).toBe(true)
    expect(domains.size).toBeGreaterThanOrEqual(20)
    // gx alone declares hundreds of terms — a token-cheap alias dictionary.
    expect(terms.length).toBeGreaterThan(200)
  })

  it('caches the parse and resets on demand', () => {
    const first = readContextTerms()
    expect(readContextTerms()).toBe(first)
    resetContextTerms()
    expect(readContextTerms()).not.toBe(first)
  })
})

describe('gx dialect: @vocab + scoped contexts', () => {
  it('resolves bare @id terms against @vocab with expanded xsd type coercion', () => {
    const gx = readContextTermsForDomain('gx')
    const accessSemantics = gx.find((t) => t.term === 'accessSemantics')

    expect(accessSemantics).toMatchObject({
      iri: `${GX_VOCAB}accessSemantics`,
      datatype: `${XSD}boolean`,
      kind: 'property',
    })
  })

  it("keeps '@id' as the object-reference coercion sentinel", () => {
    const gx = readContextTermsForDomain('gx')
    const acceptedIssuers = gx.find((t) => t.term === 'acceptedIssuers')

    expect(acceptedIssuers).toMatchObject({
      iri: `${GX_VOCAB}acceptedIssuers`,
      datatype: '@id',
    })
  })

  it('harvests scoped (nested) context terms and expands their compact IRIs', () => {
    const gx = readContextTermsForDomain('gx')
    // `accessAttributes` carries a scoped context: text → skos:notation.
    const text = gx.find((t) => t.term === 'text')
    expect(text?.iri).toBe('http://www.w3.org/2004/02/skos/core#notation')
  })

  it('drops keyword aliases — "meaning": "@id" maps to a JSON-LD keyword, not an IRI', () => {
    const gx = readContextTermsForDomain('gx')
    expect(gx.find((t) => t.term === 'meaning')).toBeUndefined()
  })
})

describe('georeference dialect: no @vocab, explicit compact IRIs', () => {
  it('expands compact @id + @type against the declared prefixes', () => {
    const geo = readContextTermsForDomain('georeference')
    const codeEPSG = geo.find((t) => t.term === 'codeEPSG')

    expect(codeEPSG).toMatchObject({
      iri: 'https://w3id.org/ascs-ev/envited-x/georeference/v5/codeEPSG',
      datatype: `${XSD}integer`,
      kind: 'property',
    })
  })

  it('keeps uncoerced terms without datatype or kind (classified later, in the term index)', () => {
    const geo = readContextTermsForDomain('georeference')
    const city = geo.find((t) => t.term === 'city')

    expect(city?.iri).toBe('https://w3id.org/ascs-ev/envited-x/georeference/v5/city')
    expect(city?.datatype).toBeUndefined()
    expect(city?.kind).toBeUndefined()
  })

  it('never surfaces namespace prefix declarations as searchable terms', () => {
    const geo = readContextTermsForDomain('georeference')
    expect(geo.find((t) => t.term === 'georeference')).toBeUndefined()
    expect(geo.find((t) => t.term === 'xsd')).toBeUndefined()
  })
})
