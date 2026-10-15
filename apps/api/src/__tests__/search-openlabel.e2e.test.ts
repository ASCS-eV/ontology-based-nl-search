/**
 * Unmocked end-to-end test of the refine endpoints for the
 * "OpenLabel only: … straight access-controlled motorway …" query.
 *
 * Unlike `routes.test.ts`, nothing below the HTTP layer is mocked: the real
 * workspace ontology, the GraphQL contract derived from it, the compiler, the
 * policy gate and an in-memory Oxigraph store loaded with the sample data
 * (including the standalone OpenLABEL V1-0-0 tags in `sample-openlabel.jsonld`,
 * which validate against the v1 shapes) all run for real.
 *
 * Covers:
 *   - every GraphQL root (asset domains AND the vocabulary itself) gets its own
 *     UNION arm ([SPARQL11] §7 — matching alternatives), so no requested
 *     domain is silently dropped by an implicit JOIN;
 *   - the vocabulary root matches standalone tags only (not tags nested in
 *     an asset), via `FILTER NOT EXISTS` ([SPARQL11] §8.1).
 */

import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { registerPolicyNamespaces } from '@ontology-search/sparql/policy'
import { beforeAll, describe, expect, it } from 'vitest'

import { app } from '../app.js'

const OL = 'https://openlabel.asam.net/V1-0-0/ontologies/'
const TAG_PREFIX = 'did:web:openlabel.example:Tag:'
const LANE_KEEPING_TAG = `${TAG_PREFIX}lane-keeping-straight-motorway`
const CONTRAST_TAG = `${TAG_PREFIX}urban-roundabout-approach`

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

  it('POST /search/refine-graphql returns hdmap and standalone tags for scenery restrictions', async () => {
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
    // scenery lives in HD maps, so scenarios do not answer a scenery restriction
    expect(ids.some((id) => id.includes(':Scenario:'))).toBe(false)
    const standalone = [...new Set(ids.filter((id) => id.startsWith(TAG_PREFIX)))]
    expect(standalone).toContain(LANE_KEEPING_TAG)
    expect(standalone).not.toContain(CONTRAST_TAG)
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
    const ids = [...new Set(assetIds(body))]
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every((id) => id.startsWith(TAG_PREFIX))).toBe(true)
    expect(ids).toContain(LANE_KEEPING_TAG)
    expect(ids).not.toContain(CONTRAST_TAG)
  }, 180_000)
})
