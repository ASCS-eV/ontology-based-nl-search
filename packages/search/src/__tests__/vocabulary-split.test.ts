/**
 * Regression tests for the schema-only vocabulary split (issue #121).
 *
 * Pins the two halves of the contract:
 *  1. `extractSchemaVocabulary` derives everything from the schema graph
 *     (enum/numeric queries carry `FROM <urn:graph:schema>` — [SHACL] §4.6.1
 *     sh:in, §4.1.1 sh:datatype) and never issues the instance-literal scan
 *     (`FILTER(isLiteral(?v))`) the old eager path ran at warmup.
 *  2. `getInstanceValues` reproduces the old eager distribution — restricted
 *     via a VALUES clause ([SPARQL11] §10.2) — and the deprecated
 *     `extractVocabulary` wrapper composes both halves identically.
 */
import type { SparqlBinding, SparqlStore } from '@ontology-search/sparql/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCompilerVocab } from '../compiler.js'
import type { CompilerVocab } from '../compiler-vocab.js'
import {
  extractSchemaVocabulary,
  extractVocabulary,
  getInstanceValues,
  resetVocabulary,
} from '../vocabulary-extractor.js'

vi.mock('../compiler.js', () => ({
  getCompilerVocab: vi.fn(),
}))

const P1 = 'https://example.org/alpha/v1/color'
const P2 = 'https://example.org/alpha/v1/length'

function uri(value: string): SparqlBinding[string] {
  return { type: 'uri', value }
}
function lit(value: string): SparqlBinding[string] {
  return { type: 'literal', value }
}

/**
 * In-memory store double that records every SPARQL string and answers the
 * four discovery queries with canned rows keyed off distinctive markers.
 */
function fakeStore(): { store: SparqlStore; queries: string[] } {
  const queries: string[] = []
  const store: SparqlStore = {
    query: async (sparql) => {
      queries.push(sparql)
      let bindings: SparqlBinding[] = []
      // Order matters: the numeric query also mentions sh:in (inside its
      // FILTER NOT EXISTS), so match the more specific markers first.
      if (sparql.includes('sh:datatype')) {
        bindings = [{ path: uri(P2), datatype: uri('http://www.w3.org/2001/XMLSchema#integer') }]
      } else if (sparql.includes('sh:in')) {
        bindings = [
          { path: uri(P1), value: lit('red') },
          { path: uri(P1), value: lit('blue') },
        ]
      } else if (sparql.includes('isLiteral(')) {
        // The instance-value distribution scan — the one query the
        // schema-only extractor must never issue.
        bindings = [
          { p: uri(P1), v: lit('red') },
          { p: uri(P1), v: lit('green') },
          { p: uri(P2), v: lit('42') },
        ]
      }
      return { head: { vars: [] }, results: { bindings } }
    },
    update: async () => {},
    loadTurtle: async () => {},
    loadJsonLd: async () => {},
    isReady: async () => true,
  }
  return { store, queries }
}

beforeEach(() => {
  resetVocabulary()
  vi.mocked(getCompilerVocab).mockResolvedValue({
    paths: new Map([
      ['alpha:color', { domain: 'alpha', propertyIri: P1 }],
      ['alpha:length', { domain: 'alpha', propertyIri: P2 }],
    ]),
  } as unknown as CompilerVocab)
})

describe('extractSchemaVocabulary (issue #121)', () => {
  it('issues no instance-data literal scan and scopes property discovery to the schema graph', async () => {
    const { store, queries } = fakeStore()
    const vocab = await extractSchemaVocabulary(store)

    // The eager distribution query must be gone from the schema path.
    expect(queries.some((q) => q.includes('isLiteral('))).toBe(false)

    // Property discovery stays scoped to the schema graph.
    const propertyQueries = queries.filter((q) => q.includes('sh:property'))
    expect(propertyQueries.length).toBeGreaterThan(0)
    for (const q of propertyQueries) {
      expect(q).toContain('FROM <urn:graph:schema>')
    }

    // The discovered vocabulary is complete — and carries no instance data.
    expect(vocab.enumProperties).toHaveLength(1)
    expect(vocab.enumProperties[0]).toMatchObject({
      iri: P1,
      domain: 'alpha',
      allowedValues: ['red', 'blue'],
    })
    expect(vocab.numericProperties).toHaveLength(1)
    expect(vocab.numericProperties[0]).toMatchObject({ iri: P2, datatype: 'integer' })
    expect(vocab.domains).toEqual(['alpha'])
    expect('instanceValues' in vocab).toBe(false)
  })
})

describe('getInstanceValues (issue #121)', () => {
  it('returns the same distribution the old eager path embedded, restricted via VALUES', async () => {
    const { store, queries } = fakeStore()
    const values = await getInstanceValues(store, [P1, P2])

    expect(values.get(P1)).toEqual(['red', 'green'])
    expect(values.get(P2)).toEqual(['42'])

    const scan = queries.find((q) => q.includes('isLiteral('))
    expect(scan).toBeDefined()
    expect(scan).toContain(`VALUES ?p { <${P1}> <${P2}> }`)
  })

  it('derives the property restriction from the schema vocabulary when omitted', async () => {
    const { store, queries } = fakeStore()
    await getInstanceValues(store)

    const scan = queries.find((q) => q.includes('isLiteral('))
    expect(scan).toBeDefined()
    expect(scan).toContain(`<${P1}>`)
    expect(scan).toContain(`<${P2}>`)
  })

  it('never issues an unbounded literal scan: empty or non-IRI input yields an empty map, no query', async () => {
    const { store, queries } = fakeStore()

    expect(await getInstanceValues(store, [])).toEqual(new Map())
    expect(await getInstanceValues(store, ['not an iri'])).toEqual(new Map())
    expect(queries.some((q) => q.includes('isLiteral('))).toBe(false)
  })

  it('deprecated extractVocabulary composes both halves identically (back-compat parity)', async () => {
    const { store } = fakeStore()
    const composed = await extractVocabulary(store)
    const schema = await extractSchemaVocabulary(store)
    const values = await getInstanceValues(store)

    expect(composed.enumProperties).toEqual(schema.enumProperties)
    expect(composed.numericProperties).toEqual(schema.numericProperties)
    expect(composed.domains).toEqual(schema.domains)
    expect(composed.classHierarchy).toEqual(schema.classHierarchy)
    expect(composed.instanceValues).toEqual(values)
  })
})
