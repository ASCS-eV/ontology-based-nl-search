/**
 * Fail-soft contract of the context reader (issue #122): the `@context`
 * artifacts are transitional enrichment, so a missing or malformed file
 * must degrade to an empty lexicon with a warning — never a throw that
 * would take schema loading down with it.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { discoverContextFiles } from '@ontology-search/ontology/sources'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  parseContextTerms,
  readContextTerms,
  resetContextTerms,
} from '../schema-index/context-reader.js'

vi.mock('@ontology-search/ontology/sources', () => ({
  discoverContextFiles: vi.fn(),
}))

let fixtureDir: string

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'context-reader-failsoft-'))
  writeFileSync(join(fixtureDir, 'bad.context.jsonld'), '{ not valid json')
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
})

beforeEach(() => {
  resetContextTerms()
})

describe('readContextTerms fail-soft', () => {
  it('skips missing and malformed files without throwing', () => {
    vi.mocked(discoverContextFiles).mockReturnValue([
      { domain: 'missing', path: join(fixtureDir, 'does-not-exist.context.jsonld') },
      { domain: 'malformed', path: join(fixtureDir, 'bad.context.jsonld') },
    ])

    expect(() => readContextTerms()).not.toThrow()
    expect(readContextTerms()).toEqual([])
  })

  it('still parses healthy files when a sibling is broken', () => {
    const good = join(fixtureDir, 'good.context.jsonld')
    writeFileSync(
      good,
      JSON.stringify({
        '@context': {
          ex: 'https://example.org/ns/',
          speed: { '@id': 'ex:speed', '@type': 'xsd:integer' },
          xsd: 'http://www.w3.org/2001/XMLSchema#',
        },
      })
    )
    vi.mocked(discoverContextFiles).mockReturnValue([
      { domain: 'malformed', path: join(fixtureDir, 'bad.context.jsonld') },
      { domain: 'good', path: good },
    ])

    expect(readContextTerms()).toEqual([
      {
        term: 'speed',
        iri: 'https://example.org/ns/speed',
        datatype: 'http://www.w3.org/2001/XMLSchema#integer',
        domain: 'good',
        kind: 'property',
      },
    ])
  })
})

describe('parseContextTerms (pure)', () => {
  it('yields an empty list for documents without a usable @context', () => {
    expect(parseContextTerms(null, 'x')).toEqual([])
    expect(parseContextTerms('not an object', 'x')).toEqual([])
    expect(parseContextTerms({}, 'x')).toEqual([])
    // Remote context reference — unresolvable offline, degrade to empty.
    expect(parseContextTerms({ '@context': 'https://remote.example/ctx.jsonld' }, 'x')).toEqual([])
  })

  it('drops terms with unknown prefixes or vocab-less bare IRIs instead of guessing', () => {
    const terms = parseContextTerms(
      { '@context': { broken: { '@id': 'nope:broken' }, bare: { '@id': 'bare' } } },
      'x'
    )
    expect(terms).toEqual([])
  })

  it('merges array-form contexts in order ([JSON-LD11] §9.15)', () => {
    const terms = parseContextTerms(
      {
        '@context': [
          { ex: 'https://example.org/ns/' },
          { width: { '@id': 'ex:width', '@type': '@id' } },
        ],
      },
      'x'
    )
    expect(terms).toEqual([
      {
        term: 'width',
        iri: 'https://example.org/ns/width',
        datatype: '@id',
        domain: 'x',
        kind: 'property',
      },
    ])
  })
})
