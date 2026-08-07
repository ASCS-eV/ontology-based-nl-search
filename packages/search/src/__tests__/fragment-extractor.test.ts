/**
 * Fragment-extractor tests against the real ontology.
 *
 * Parseability is proven by ROUND-TRIPPING each emitted fragment through
 * the store's own Turtle parser (`loadTurtle` into a throwaway named
 * graph) — the store API has no CONSTRUCT surface, and this exercises the
 * exact parser production uses. Assertions are generic (any ontology
 * set) except the explicit gx coverage proof.
 */
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { beforeAll, describe, expect, it } from 'vitest'

import type { SparqlStore, TermCard } from '../index.js'
import { getInitializedStore } from '../init.js'
import {
  extractShaclFragments,
  renderDistilledCards,
  serializeTerm,
} from '../schema-index/fragment-extractor.js'
import { buildTermIndex } from '../schema-index/term-index.js'

let store: SparqlStore

beforeAll(async () => {
  store = await getInitializedStore()
}, 120_000)

/** Round-trip a fragment through the store's Turtle parser; returns its triple count. */
async function parseFragment(turtle: string, graph: string): Promise<number> {
  await store.loadTurtle(turtle, graph)
  const res = await store.query(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`)
  return Number(res.results.bindings[0]?.['n']?.value ?? 0)
}

describe('extractShaclFragments', () => {
  it('emits a parseable, minimal fragment for a target class', async () => {
    const registry = await buildDomainRegistry()
    const descriptor = [...registry.domains.values()].find((d) => d.targetClassIri)
    expect(descriptor).toBeDefined()

    const fragments = await extractShaclFragments(store, {
      targetClasses: [descriptor!.targetClassIri],
    })
    expect(fragments.length).toBeGreaterThan(0)

    const fragment = fragments[0]!
    expect(fragment.domain).toBe(descriptor!.name)
    expect(fragment.turtle).toContain('sh:targetClass')
    expect(fragment.turtle).toContain('sh:path')

    const triples = await parseFragment(fragment.turtle, 'urn:test:fragment-roundtrip-1')
    expect(triples).toBeGreaterThan(2)
  })

  it('restricts property blocks to the selected sh:path IRIs', async () => {
    const index = await buildTermIndex(store)
    const enumCard = index.cards.find((c) => c.kind === 'property' && c.allowedValues)
    expect(enumCard).toBeDefined()

    const fragments = await extractShaclFragments(store, {
      propertyIris: [enumCard!.iri],
    })
    expect(fragments.length).toBeGreaterThan(0)

    for (const fragment of fragments) {
      // Exactly one property block per shape — the selected one.
      expect(fragment.turtle.match(/sh:path /g)).toHaveLength(1)
      expect(fragment.turtle).toContain('sh:in (')
    }
  })

  it('extracts fragments for the largest domain (gx) from the schema graph', async () => {
    const registry = await buildDomainRegistry()
    const gx = registry.domains.get('gx')
    expect(gx?.targetClassIri).toBeTruthy()

    const fragments = await extractShaclFragments(store, { targetClasses: [gx!.targetClassIri] })
    expect(fragments.length).toBeGreaterThan(0)
    const triples = await parseFragment(fragments[0]!.turtle, 'urn:test:fragment-roundtrip-gx')
    expect(triples).toBeGreaterThan(0)
  })

  it('returns [] for an empty selection instead of dumping the world', async () => {
    expect(await extractShaclFragments(store, {})).toEqual([])
  })

  it('declares only the prefixes the fragment body uses', async () => {
    const registry = await buildDomainRegistry()
    const descriptor = [...registry.domains.values()].find((d) => d.targetClassIri)
    const [fragment] = await extractShaclFragments(store, {
      targetClasses: [descriptor!.targetClassIri],
    })

    for (const line of fragment!.turtle.split('\n')) {
      const match = /^@prefix ([\w.-]+): /.exec(line)
      if (!match) continue
      const body = fragment!.turtle
        .split('\n')
        .filter((l) => !l.startsWith('@prefix'))
        .join('\n')
      expect(body, `unused prefix ${match[1]}`).toMatch(new RegExp(`(^|[\\s(,^])${match[1]}:`))
    }
  })
})

describe('serializeTerm — literal escaping', () => {
  const ns = new Map<string, string>()

  /**
   * Regression: the serializer used to escape `\`, `"` and LF only. A literal
   * carrying CR — ordinary in a `.ttl` authored on Windows, or written as a
   * `\r` escape in a `sh:description` — was re-emitted with a RAW CR inside
   * the quotes, which `STRING_LITERAL_QUOTE` forbids ([TURTLE] §6.5). The
   * fragment then failed to parse when the retrieval layer loaded it, and it
   * reaches the LLM system prompt either way.
   */
  it('escapes CR, which the previous in-file escaper emitted raw', () => {
    const out = serializeTerm({ type: 'literal', value: 'before\rafter' }, ns)
    expect(out).toBe('"before\\rafter"')
    expect(out).not.toContain('\r')
  })

  it('leaves no raw character below U+0020 in the emitted literal', () => {
    for (let code = 0; code < 0x20; code++) {
      const ch = String.fromCharCode(code)
      expect(serializeTerm({ type: 'literal', value: `a${ch}b` }, ns)).not.toContain(ch)
    }
  })

  it('still escapes the quote and backslash cases it always handled', () => {
    expect(serializeTerm({ type: 'literal', value: 'say "hi"' }, ns)).toBe('"say \\"hi\\""')
    expect(serializeTerm({ type: 'literal', value: 'a\\b' }, ns)).toBe('"a\\\\b"')
  })

  it('preserves the language tag and datatype forms', () => {
    expect(serializeTerm({ type: 'literal', value: 'Straße', 'xml:lang': 'de' }, ns)).toBe(
      '"Straße"@de'
    )
    expect(
      serializeTerm(
        { type: 'literal', value: '3', datatype: 'http://www.w3.org/2001/XMLSchema#integer' },
        ns
      )
    ).toBe('"3"^^<http://www.w3.org/2001/XMLSchema#integer>')
  })
})

describe('renderDistilledCards', () => {
  const card = (overrides: Partial<TermCard>): TermCard => ({
    kind: 'property',
    iri: 'https://example.org/ns/speedLimit',
    localName: 'speedLimit',
    domain: 'alpha',
    labels: ['speed limit', 'speedLimit'],
    ...overrides,
  })

  it('renders one dense line with label, datatype, description, and enum values', () => {
    const output = renderDistilledCards([
      card({
        datatype: 'http://www.w3.org/2001/XMLSchema#integer',
        description: 'Maximum permitted speed',
        allowedValues: ['30', '50', '100'],
      }),
    ])
    expect(output).toBe('speedLimit : integer — "Maximum permitted speed" [30|50|100]')
  })

  it('renders reference edges and is deterministic across input order', () => {
    const a = card({ iri: 'https://example.org/ns/a', localName: 'a' })
    const b = card({
      iri: 'https://example.org/ns/b',
      localName: 'b',
      referencesDomain: 'beta',
    })
    expect(renderDistilledCards([b, a])).toBe(renderDistilledCards([a, b]))
    expect(renderDistilledCards([b])).toBe('b → beta')
  })

  it('caps long enumerations with an explicit remainder marker — never silent truncation', () => {
    const values = Array.from({ length: 60 }, (_, i) => `v${i}`)
    const output = renderDistilledCards([card({ allowedValues: values })])
    expect(output).toContain('…+10 more')
    expect(output).toContain('v49')
    expect(output).not.toContain('v50|')
  })
})
