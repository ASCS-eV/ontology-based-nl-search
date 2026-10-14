/**
 * Unmocked end-to-end test of the refine endpoints for the
 * "OpenLabel only: … straight access-controlled motorway …" query.
 *
 * Unlike `routes.test.ts`, nothing below the HTTP layer is mocked: the real
 * workspace ontology, the GraphQL contract derived from it, the compiler, the
 * policy gate and an in-memory Oxigraph store loaded with the sample data
 * (including the standalone OpenLABEL tags in `sample-openlabel.jsonld`) all
 * run for real.
 *
 * Covers:
 *   - every GraphQL root (asset domains AND the vocabulary itself) gets its own
 *     UNION arm ([SPARQL11] §8.3 / §18.2.2.4 — a group of alternatives), so no
 *     requested domain is silently dropped by an implicit JOIN;
 *   - the vocabulary root matches standalone tags only (not tags nested in
 *     an asset), via `FILTER NOT EXISTS` ([SPARQL11] §8.1).
 */

import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { registerPolicyNamespaces } from '@ontology-search/sparql/policy'
import { beforeAll, describe, expect, it } from 'vitest'

import { app } from '../app.js'

const OL = 'https://openlabel.asam.net/V1-0-0/ontologies/'
const LANE_KEEPING_TAGS = [
  'did:web:openlabel.example:Tag:standalone-001',
  'did:web:openlabel.example:Tag:standalone-005',
  'did:web:openlabel.example:Tag:standalone-006',
  'did:web:openlabel.example:Tag:standalone-009',
]

interface RefineBody {
  sparql: string
  results: Record<string, string>[]
  meta: { matchCount: number }
}

const post = (path: string, body: unknown): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

function assetIds(body: RefineBody): string[] {
  return body.results.map((row) => row['asset'] ?? row['id'] ?? '')
}

describe('OpenLABEL-only refine (unmocked end-to-end)', () => {
  // The same policy-namespace registration warmup performs at startup.
  beforeAll(async () => {
    const registry = await buildDomainRegistry()
    registerPolicyNamespaces(registry.getAllNamespaces())
  }, 180_000)

  it('POST /search/refine-graphql returns hdmap, scenario and standalone tags', async () => {
    const roots = ['hdmap', 'scenario', 'openlabel']
      .map(
        (root) =>
          `${root} { DrivableAreaType(values: ["${OL}MotorwayManaged"]) HorizontalStraights(values: ["true"]) }`
      )
      .join('\n')
    const res = await post('/search/refine-graphql', { graphql: `query {\n${roots}\n}` })
    const text = await res.text()
    expect(res.status, text).toBe(200)
    const body = JSON.parse(text) as RefineBody

    expect(body.sparql.match(/\bUNION\b/g)).toHaveLength(2)
    expect(body.sparql).toContain('hdmap:HdMap')
    expect(body.sparql).toContain('scenario:Scenario')
    expect(body.sparql).toContain('FILTER NOT EXISTS')

    const ids = assetIds(body)
    expect(ids.some((id) => id.includes(':HdMap:'))).toBe(true)
    expect(ids.some((id) => id.includes(':Scenario:'))).toBe(true)
    const standalone = [...new Set(ids.filter((id) => id.includes(':Tag:')))].sort()
    expect(standalone).toEqual(LANE_KEEPING_TAGS)
  }, 180_000)

  it('POST /search/refine with only the vocabulary returns only standalone tags', async () => {
    const res = await post('/search/refine', {
      slots: {
        domains: ['openlabel'],
        filters: { DrivableAreaType: `${OL}MotorwayManaged`, HorizontalStraights: 'true' },
        ranges: {},
      },
    })
    const text = await res.text()
    expect(res.status, text).toBe(200)
    const body = JSON.parse(text) as RefineBody
    expect(body.sparql).not.toMatch(/\bUNION\b/)
    expect([...new Set(assetIds(body))].sort()).toEqual(LANE_KEEPING_TAGS)
  }, 180_000)
})
