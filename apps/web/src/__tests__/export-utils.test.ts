import { describe, expect, it } from 'vitest'

import { resultsToCsv, resultsToJsonLd, sanitizeCsvCell } from '../lib/export-utils'

describe('sanitizeCsvCell', () => {
  it('prefixes formula-injection characters with single quote', () => {
    expect(sanitizeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(sanitizeCsvCell('+cmd|')).toBe("'+cmd|")
    expect(sanitizeCsvCell('-cmd|')).toBe("'-cmd|")
    expect(sanitizeCsvCell('@import')).toBe("'@import")
    expect(sanitizeCsvCell('\tcmd')).toBe("'\tcmd")
    expect(sanitizeCsvCell('\rcmd')).toBe("'\rcmd")
  })

  it('leaves normal values unchanged', () => {
    expect(sanitizeCsvCell('hello')).toBe('hello')
    expect(sanitizeCsvCell('123')).toBe('123')
    expect(sanitizeCsvCell('https://example.com')).toBe('https://example.com')
  })
})

describe('resultsToCsv', () => {
  it('generates CSV with headers and sanitized cells', () => {
    const results = [
      { name: 'Asset 1', value: '=malicious' },
      { name: 'Asset 2', value: 'safe' },
    ]
    const csv = resultsToCsv(results, ['name', 'value'])

    expect(csv).toContain('name,value')
    expect(csv).toContain('"Asset 1","\'=malicious"')
    expect(csv).toContain('"Asset 2","safe"')
  })

  it('escapes double quotes in values', () => {
    const results = [{ name: 'has "quotes"' }]
    const csv = resultsToCsv(results, ['name'])
    expect(csv).toContain('"has ""quotes"""')
  })
})

describe('resultsToJsonLd', () => {
  it('produces a valid JSON-LD structure', () => {
    const results = [{ asset: 'https://example.org/ns/Asset1', name: 'Test' }]
    const jsonLd = resultsToJsonLd(results) as { '@context': object; '@graph': object[] }

    expect(jsonLd).toHaveProperty('@context')
    expect(jsonLd).toHaveProperty('@graph')
    expect(jsonLd['@graph']).toHaveLength(1)
  })

  it('sets @id from URI values', () => {
    const results = [{ asset: 'https://example.org/ns/Asset1', label: 'My Asset' }]
    const jsonLd = resultsToJsonLd(results) as { '@graph': Record<string, string>[] }
    expect(jsonLd['@graph'][0]?.['@id']).toBe('https://example.org/ns/Asset1')
    expect(jsonLd['@graph'][0]?.label).toBe('My Asset')
  })

  it('derives context namespaces from URI values', () => {
    const results = [{ asset: 'https://example.org/ontology/v1/Thing1' }]
    const jsonLd = resultsToJsonLd(results) as { '@context': Record<string, string> }
    expect(Object.values(jsonLd['@context'])).toContain('https://example.org/ontology/v1/')
  })

  it('handles results with no URIs gracefully', () => {
    const results = [{ name: 'plain text', count: '42' }]
    const jsonLd = resultsToJsonLd(results) as { '@context': object; '@graph': object[] }
    expect(jsonLd['@context']).toEqual({})
    expect(jsonLd['@graph']).toHaveLength(1)
  })
})
