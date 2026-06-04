import { describe, expect, it } from 'vitest'

import type { ExportAsset } from '../lib/export-utils'
import {
  isInternalTraceColumn,
  isIriValue,
  resultsToCsv,
  resultsToJsonLd,
  sanitizeCsvCell,
} from '../lib/export-utils'

describe('sanitizeCsvCell', () => {
  it('prefixes formula-injection characters with single quote', () => {
    expect(sanitizeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(sanitizeCsvCell('+cmd|')).toBe("'+cmd|")
    expect(sanitizeCsvCell('-cmd|')).toBe("'-cmd|")
    expect(sanitizeCsvCell('@import')).toBe("'@import")
    expect(sanitizeCsvCell('\tcmd')).toBe("'\tcmd")
    expect(sanitizeCsvCell('\rcmd')).toBe("'\rcmd")
    expect(sanitizeCsvCell('\ncmd')).toBe("'\ncmd")
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

describe('isInternalTraceColumn', () => {
  it('flags chain + data-path intermediates (incl. nested) and nothing else', () => {
    for (const k of ['ref_step_1', 'ref_step_2', 'ref_0_step_1', '_refSlot_0', '_refSlot_0_1']) {
      expect(isInternalTraceColumn(k)).toBe(true)
    }
    for (const k of ['asset', 'name', 'country', 'refAsset', 'refName', 'refAsset_0']) {
      expect(isInternalTraceColumn(k)).toBe(false)
    }
  })
})

describe('isIriValue', () => {
  it('recognizes any IRI scheme, not just http(s)', () => {
    expect(isIriValue('https://example.org/x')).toBe(true)
    expect(isIriValue('did:web:simtrace.io:Scenario:cut-out-008')).toBe(true)
    expect(isIriValue('urn:uuid:1234')).toBe(true)
  })
  it('rejects literals', () => {
    expect(isIriValue('DE')).toBe(false)
    expect(isIriValue('Cut Out in Cologne')).toBe(false)
    expect(isIriValue('note: a thing')).toBe(false) // space after colon
  })
})

describe('resultsToCsv — internal columns', () => {
  it('drops compiler-internal trace-step columns but keeps reference columns', () => {
    const results = [{ asset: 'a', refAsset: 'r', ref_step_1: 'blank-node', refAsset_0: 'm' }]
    const csv = resultsToCsv(results, ['asset', 'refAsset', 'ref_step_1', 'refAsset_0'])
    expect(csv.split('\n')[0]).toBe('asset,refAsset,refAsset_0') // ref_step_1 stripped
    expect(csv).not.toContain('blank-node')
  })
})

describe('resultsToJsonLd', () => {
  const asset = (over: Partial<ExportAsset>): ExportAsset => ({
    asset: 'https://example.org/ns/Asset1',
    properties: {},
    references: [],
    ...over,
  })

  it('produces a valid JSON-LD structure', () => {
    const jsonLd = resultsToJsonLd([asset({ properties: { name: 'Test' } })]) as {
      '@context': object
      '@graph': object[]
    }
    expect(jsonLd).toHaveProperty('@context')
    expect(jsonLd['@graph']).toHaveLength(1)
  })

  it('uses the asset IRI as @id and keeps properties', () => {
    const jsonLd = resultsToJsonLd([asset({ properties: { name: 'My Asset' } })]) as {
      '@graph': Record<string, string>[]
    }
    expect(jsonLd['@graph'][0]?.['@id']).toBe('https://example.org/ns/Asset1')
    expect(jsonLd['@graph'][0]?.name).toBe('My Asset')
  })

  it('sets @id for non-http IRI schemes (did:web) — the previous http-only bug', () => {
    const jsonLd = resultsToJsonLd([
      asset({ asset: 'did:web:simtrace.io:Scenario:cut-out-008', properties: { country: 'DE' } }),
    ]) as { '@graph': Record<string, string>[] }
    expect(jsonLd['@graph'][0]?.['@id']).toBe('did:web:simtrace.io:Scenario:cut-out-008')
    expect(jsonLd['@graph'][0]?.country).toBe('DE')
  })

  it('nests references as @id objects (chain preserved)', () => {
    const jsonLd = resultsToJsonLd([
      asset({
        asset: 'did:web:x:Scenario:1',
        references: [
          {
            asset: 'did:web:x:OSITrace:1',
            name: 'Trace',
            references: [{ asset: 'did:web:x:HdMap:1', name: 'Map', references: [] }],
          },
        ],
      }),
    ]) as { '@graph': Array<{ references: Array<Record<string, unknown>> }> }
    const trace = jsonLd['@graph'][0]!.references[0]!
    expect(trace['@id']).toBe('did:web:x:OSITrace:1')
    const map = (trace['references'] as Array<Record<string, unknown>>)[0]!
    expect(map['@id']).toBe('did:web:x:HdMap:1')
  })

  it('includes lineage when present', () => {
    const jsonLd = resultsToJsonLd([
      asset({ lineage: [{ asset: 'did:web:x:HdMap:9', name: 'Reachable', references: [] }] }),
    ]) as { '@graph': Array<{ lineage?: Array<Record<string, unknown>> }> }
    expect(jsonLd['@graph'][0]!.lineage?.[0]?.['@id']).toBe('did:web:x:HdMap:9')
  })

  it('derives http(s) context namespaces and resolves prefix collisions', () => {
    const jsonLd = resultsToJsonLd([
      asset({
        asset: 'https://example.org/v1/Thing1',
        properties: { p: 'https://other.org/v1/T2' },
      }),
    ]) as { '@context': Record<string, string> }
    const prefixes = Object.keys(jsonLd['@context'])
    expect(new Set(prefixes).size).toBe(prefixes.length)
    expect(prefixes).toContain('v1')
    expect(prefixes).toContain('v12')
  })

  it('handles assets with no IRIs gracefully (empty context)', () => {
    const jsonLd = resultsToJsonLd([asset({ asset: 'plain-id', properties: { name: 'x' } })]) as {
      '@context': object
      '@graph': object[]
    }
    expect(jsonLd['@context']).toEqual({})
    expect(jsonLd['@graph']).toHaveLength(1)
  })
})
