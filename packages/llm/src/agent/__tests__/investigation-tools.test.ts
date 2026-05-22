/**
 * Unit tests for ontology investigation tools.
 *
 * Tests the Vercel AI SDK investigation tools against the real SHACL schema
 * loaded into Oxigraph. Verifies each tool returns structured, non-empty
 * results and handles edge cases gracefully.
 *
 * These tests are ontology-agnostic: they assert structural properties
 * (has domains, has properties, returns arrays) rather than specific domain names.
 */

import { getInitializedStore, SCHEMA_GRAPH } from '@ontology-search/search'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { beforeAll, describe, expect, it } from 'vitest'

import { createInvestigationTools } from '../investigation-tools.js'

let store: SparqlStore
let tools: ReturnType<typeof createInvestigationTools>

beforeAll(async () => {
  store = await getInitializedStore()
  tools = createInvestigationTools(store)
}, 60_000)

describe('discover_domains', () => {
  it('returns at least one domain with classIri', async () => {
    const result = await tools.discover_domains.execute({}, { toolCallId: 'test', messages: [] })
    expect(result.count).toBeGreaterThan(0)
    expect(result.domains[0]).toHaveProperty('domain')
    expect(result.domains[0]).toHaveProperty('classIri')
    expect(result.domains[0]!.classIri).toMatch(/^https?:\/\//)
  })

  it('domain names are non-empty strings', async () => {
    const result = await tools.discover_domains.execute({}, { toolCallId: 'test', messages: [] })
    for (const d of result.domains) {
      expect(d.domain.length).toBeGreaterThan(0)
    }
  })
})

describe('discover_properties', () => {
  it('returns properties for a discovered domain', async () => {
    // First discover a domain, then get its properties
    const domains = await tools.discover_domains.execute({}, { toolCallId: 'test', messages: [] })
    const firstDomain = domains.domains[0]!.domain

    const result = await tools.discover_properties.execute(
      { domain: firstDomain },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.count).toBeGreaterThan(0)
    expect(result.domain).toBe(firstDomain)
    expect(result.properties[0]).toHaveProperty('localName')
    expect(result.properties[0]).toHaveProperty('path')
  })

  it('returns empty for a non-existent domain', async () => {
    const result = await tools.discover_properties.execute(
      { domain: 'nonexistent-domain-xyz' },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.count).toBe(0)
    expect(result.properties).toEqual([])
  })
})

describe('discover_values', () => {
  it('returns enumerated values for a property with sh:in', async () => {
    // Find a domain and property that has enumerated values
    const domains = await tools.discover_domains.execute({}, { toolCallId: 'test', messages: [] })
    const firstDomain = domains.domains[0]!.domain

    const props = await tools.discover_properties.execute(
      { domain: firstDomain },
      { toolCallId: 'test', messages: [] }
    )
    const enumProp = props.properties.find((p) => p.hasEnumeratedValues)

    if (!enumProp) {
      // If no enum properties in first domain, try others
      for (const d of domains.domains.slice(1)) {
        const otherProps = await tools.discover_properties.execute(
          { domain: d.domain },
          { toolCallId: 'test', messages: [] }
        )
        const found = otherProps.properties.find((p) => p.hasEnumeratedValues)
        if (found) {
          const result = await tools.discover_values.execute(
            { propertyName: found.localName, domain: d.domain },
            { toolCallId: 'test', messages: [] }
          )
          expect(result.count).toBeGreaterThan(0)
          expect(result.values.length).toBeGreaterThan(0)
          return
        }
      }
      // No enum properties found at all — skip test
      return
    }

    const result = await tools.discover_values.execute(
      { propertyName: enumProp.localName, domain: firstDomain },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.count).toBeGreaterThan(0)
    expect(result.values.length).toBeGreaterThan(0)
  })

  it('returns empty for a non-existent property', async () => {
    const result = await tools.discover_values.execute(
      { propertyName: 'nonExistentProperty999', domain: '' },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.count).toBe(0)
    expect(result.values).toEqual([])
  })
})

describe('discover_connections', () => {
  it('returns cross-domain connections', async () => {
    const result = await tools.discover_connections.execute(
      { domain: '' },
      { toolCallId: 'test', messages: [] }
    )
    // May or may not have connections depending on the loaded ontologies
    expect(result).toHaveProperty('connections')
    expect(result).toHaveProperty('count')
    expect(Array.isArray(result.connections)).toBe(true)

    if (result.count > 0) {
      expect(result.connections[0]).toHaveProperty('from')
      expect(result.connections[0]).toHaveProperty('to')
      expect(result.connections[0]!.from).not.toBe(result.connections[0]!.to)
    }
  })

  it('filters by domain when specified', async () => {
    const all = await tools.discover_connections.execute(
      { domain: '' },
      { toolCallId: 'test', messages: [] }
    )
    if (all.count === 0) return // No connections to test with

    const firstDomain = all.connections[0]!.from
    const filtered = await tools.discover_connections.execute(
      { domain: firstDomain },
      { toolCallId: 'test', messages: [] }
    )
    // Filtered should be subset of all
    expect(filtered.count).toBeLessThanOrEqual(all.count)
    for (const c of filtered.connections) {
      expect(
        c.from.toLowerCase().includes(firstDomain.toLowerCase()) ||
          c.to.toLowerCase().includes(firstDomain.toLowerCase())
      ).toBe(true)
    }
  })
})

describe('investigate_schema', () => {
  it('executes a valid SELECT query', async () => {
    const result = await tools.investigate_schema.execute(
      {
        sparql: `PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?shape WHERE { ?shape a sh:NodeShape } LIMIT 5`,
      },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.error).toBeUndefined()
    expect(result.count).toBeGreaterThan(0)
    expect(result.variables).toContain('shape')
  })

  it('rejects write operations', async () => {
    const result = await tools.investigate_schema.execute(
      { sparql: 'INSERT DATA { <x> <y> <z> }' },
      { toolCallId: 'test', messages: [] }
    )
    // INSERT doesn't start with SELECT or PREFIX, so first guard catches it
    expect(result.error).toBeDefined()
    expect(result.results).toEqual([])
  })

  it('rejects write operations disguised with PREFIX', async () => {
    const result = await tools.investigate_schema.execute(
      { sparql: 'PREFIX ex: <http://example.org/> DELETE DATA { ex:a ex:b ex:c }' },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.error).toContain('Write operations are not allowed')
    expect(result.results).toEqual([])
  })

  it('rejects non-SELECT queries', async () => {
    const result = await tools.investigate_schema.execute(
      { sparql: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }' },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.error).toContain('Only SELECT queries are allowed')
    expect(result.results).toEqual([])
  })

  it('returns error for invalid SPARQL syntax', async () => {
    const result = await tools.investigate_schema.execute(
      { sparql: 'SELECT ?x WHERE { INVALID SYNTAX !!!}' },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.error).toMatch(/Query failed/)
    expect(result.results).toEqual([])
  })

  it('limits results to 50 rows', async () => {
    const result = await tools.investigate_schema.execute(
      {
        sparql: `PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100`,
      },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.error).toBeUndefined()
    // Even though query asks for 100, tool caps at 50
    expect(result.count).toBeLessThanOrEqual(50)
  })

  it('auto-wraps with schema graph FROM clause', async () => {
    // Query without explicit GRAPH reference should still work
    const result = await tools.investigate_schema.execute(
      {
        sparql: `PREFIX sh: <http://www.w3.org/ns/shacl#>
SELECT ?shape WHERE { ?shape a sh:NodeShape } LIMIT 3`,
      },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.error).toBeUndefined()
    expect(result.count).toBeGreaterThan(0)
  })
})

describe('SPARQL injection safety', () => {
  it('discover_properties escapes malicious domain input', async () => {
    const malicious = 'hdmap") || ?cls = <http://evil.com> || CONTAINS(?cls, "'
    const result = await tools.discover_properties.execute(
      { domain: malicious },
      { toolCallId: 'test', messages: [] }
    )
    // Should not throw or return injected data — just zero results
    expect(result.count).toBe(0)
    expect(Array.isArray(result.properties)).toBe(true)
  })

  it('discover_values escapes malicious propertyName input', async () => {
    const malicious = 'roadTypes") || ?path = <http://evil> #'
    const result = await tools.discover_values.execute(
      { propertyName: malicious },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.count).toBe(0)
    expect(Array.isArray(result.values)).toBe(true)
  })

  it('discover_connections escapes malicious domain input', async () => {
    const malicious = 'x")) . ?s <http://evil> ?o } #'
    const result = await tools.discover_connections.execute(
      { domain: malicious },
      { toolCallId: 'test', messages: [] }
    )
    expect(result.count).toBe(0)
    expect(Array.isArray(result.connections)).toBe(true)
  })
})
