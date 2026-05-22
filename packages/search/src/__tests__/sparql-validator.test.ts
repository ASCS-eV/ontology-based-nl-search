import { describe, expect, it } from 'vitest'

import { validateSparql } from '../sparql-validator.js'

describe('validateSparql', () => {
  it('accepts valid SPARQL with standard FILTER functions', () => {
    const result = validateSparql(`
      PREFIX ex: <http://example.org/>
      SELECT ?item ?label WHERE {
        ?item ex:country ?country .
        OPTIONAL { ?item ex:label ?label }
        FILTER(BOUND(?label) || CONTAINS(LCASE(STR(?country)), "fr"))
        FILTER(REGEX(STR(?country), "FR$", "i"))
      }
    `)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('reports invalid prefixes as parse errors', () => {
    const result = validateSparql('SELECT ?item WHERE { ?item ex:country ?country }')

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Unknown prefix')
  })

  it('reports undefined variables used in filters', () => {
    const result = validateSparql(`
      PREFIX ex: <http://example.org/>
      SELECT ?item WHERE {
        ?item ex:country ?country .
        FILTER(?missing = "FR")
      }
    `)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Undefined variable ?missing.')
  })

  it('reports invalid FILTER function arguments early', () => {
    const result = validateSparql(`
      PREFIX ex: <http://example.org/>
      SELECT ?item WHERE {
        ?item ex:country ?country .
        FILTER(REGEX(?country, "^FR", 1))
      }
    `)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('REGEX flags must be a string literal.')
  })

  it('warns about IRI and string literal comparisons', () => {
    const result = validateSparql(`
      SELECT ?country WHERE {
        BIND(<http://example.org/country/FR> AS ?country)
        FILTER(?country = "FR")
      }
    `)

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain(
      'Possible IRI/literal mismatch in =: compare ?country via STR(...) before using a string literal.'
    )
  })

  it('warns on raw string functions for terms and clears the warning with STR()', () => {
    const rawResult = validateSparql(`
      PREFIX ex: <http://example.org/>
      SELECT ?item WHERE {
        ?item ex:country ?country .
        FILTER(CONTAINS(?country, "FR"))
      }
    `)

    expect(rawResult.valid).toBe(true)
    expect(rawResult.warnings).toContain(
      'contains is applied to a raw RDF term; wrap it with STR(...) when the value may be an IRI.'
    )

    const normalizedResult = validateSparql(`
      PREFIX ex: <http://example.org/>
      SELECT ?item WHERE {
        ?item ex:country ?country .
        FILTER(CONTAINS(STR(?country), "FR"))
      }
    `)

    expect(normalizedResult.valid).toBe(true)
    expect(normalizedResult.warnings).toEqual([])
  })
})
