/**
 * Schema-lookup tool handlers against the real ontology.
 *
 * The security property under test: every handler resolves its arguments
 * through the term index and answers from index lookups or
 * compiler-emitted SPARQL — unknown identifiers return an error object
 * (never a throw, never an improvised query), so no model-supplied string
 * can reach the store as query text.
 */
import { buildTermIndex, getInitializedStore } from '@ontology-search/search'
import { beforeAll, describe, expect, it } from 'vitest'

import { SCHEMA_TOOL_DEFINITIONS, SCHEMA_TOOL_NAMES } from '../schema-tools.js'

function tool(name: (typeof SCHEMA_TOOL_NAMES)[number]) {
  return SCHEMA_TOOL_DEFINITIONS.find((d) => d.name === name)!
}

let enumIri: string
let enumName: string
let enumDomain: string
let enumValue: string

beforeAll(async () => {
  const store = await getInitializedStore()
  const index = await buildTermIndex(store)
  const card = index.cards.find(
    (c) => c.kind === 'property' && c.allowedValues && c.allowedValues.length > 0
  )!
  enumIri = card.iri
  enumName = card.localName
  enumDomain = card.domain
  enumValue = card.allowedValues![0]!
}, 120_000)

describe('schema-lookup tools', () => {
  it('registers exactly the policy-advertised tool set', () => {
    expect(SCHEMA_TOOL_DEFINITIONS.map((d) => d.name)).toEqual([...SCHEMA_TOOL_NAMES])
  })

  it('find_terms returns compact, index-grounded matches', async () => {
    const result = await tool('find_terms').handler({ text: enumName })
    const matches = result['matches'] as Array<Record<string, unknown>>

    expect(matches.length).toBeGreaterThan(0)
    expect(matches.length).toBeLessThanOrEqual(8)
    const hit = matches.find((m) => m['iri'] === enumIri)
    expect(hit).toMatchObject({ localName: enumName, domain: enumDomain })
  })

  it('describe_shape answers with parseable SHACL for a known IRI and an error for an unknown one', async () => {
    const known = await tool('describe_shape').handler({ iri: enumIri })
    expect(known['turtle']).toContain('sh:path')
    expect(known['domain']).toBe(enumDomain)

    const unknown = await tool('describe_shape').handler({ iri: 'urn:nope:invented' })
    expect(unknown['error']).toContain('find_terms')
    expect(unknown['turtle']).toBeUndefined()
  })

  it('list_values pairs declared sh:in values with live observed values', async () => {
    const result = await tool('list_values').handler({ propertyIri: enumIri })
    expect(result['allowedValues']).toContain(enumValue)
    expect(Array.isArray(result['observedValues'])).toBe(true)

    const unknown = await tool('list_values').handler({ propertyIri: 'urn:nope:invented' })
    expect(unknown['error']).toBeDefined()
  })

  it('probe_data counts a domain and rejects unknown domains and properties', async () => {
    const plain = await tool('probe_data').handler({ domain: enumDomain })
    expect(typeof plain['count']).toBe('number')

    const filtered = await tool('probe_data').handler({
      domain: enumDomain,
      filters: { [enumName]: enumValue },
    })
    expect(typeof filtered['matches']).toBe('number')

    const badDomain = await tool('probe_data').handler({ domain: 'not-a-domain' })
    expect(badDomain['error']).toBeDefined()

    const badProperty = await tool('probe_data').handler({
      domain: enumDomain,
      filters: { inventedProperty: 'x' },
    })
    expect(badProperty['error']).toContain('inventedProperty')
  })

  it('rejects malformed arguments through the shared Zod schemas', async () => {
    await expect(tool('find_terms').handler({})).rejects.toThrow()
    await expect(tool('probe_data').handler({ domain: 42 })).rejects.toThrow()
  })
})
