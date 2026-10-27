/**
 * Metadata-index integration tests.
 *
 * Asserts the generic facet contract: any property the SHACL shape
 * graph classifies into a group (`Content`, `Format`, `Quality`,
 * `DataSource`, …) shows up under that group's name in the per-asset
 * snapshot, and the aggregate view returns distribution stats per
 * property across the domain.
 *
 * Generic — derives every fixture-specific identifier (a sample asset
 * IRI, a discovered group name) from the live store and registry. No
 * ontology names are hardcoded; the tests stay correct as new
 * ontologies are loaded as long as *some* shape group exists.
 */
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { Parser } from 'sparqljs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getAssetDomains } from '../asset-domains.js'
import { getCompilerVocab } from '../compiler.js'
import { getInitializedStore } from '../init.js'
import {
  type AssetMetadata,
  getAssetMetadata,
  getDomainMetadataAggregate,
  shapeGroupFacets,
  valueStats,
} from '../metadata-index.js'
import { resetReferenceIndex } from '../reference-index.js'

beforeAll(async () => {
  await getInitializedStore()
  // Ensure the reference index isn't carrying state from earlier tests.
  resetReferenceIndex()
}, 120_000)

afterAll(() => {
  resetReferenceIndex()
})

/**
 * Pick (domain, group) from the live facet index so the test targets a
 * real facet without hardcoding its name.
 */
async function pickDomainAndGroup(): Promise<{ domain: string; group: string } | null> {
  const [vocab, assetDomains] = await Promise.all([getCompilerVocab(), getAssetDomains()])
  for (const domain of [...assetDomains.keys()].sort()) {
    const facet = shapeGroupFacets(vocab, domain)[0]
    if (facet) return { domain, group: facet.group }
  }
  return null
}

/** Find any asset IRI of an asset class so we can fetch its metadata. */
async function pickAssetIri(domain: string): Promise<string | null> {
  const store = await getInitializedStore()
  const result = await store.query(`
    SELECT ?asset WHERE {
      ?asset a ?t .
      FILTER(isIRI(?asset))
      FILTER(STRSTARTS(STR(?asset), "did:") || STRSTARTS(STR(?asset), "http"))
    }
    LIMIT 1
  `)
  // Filter further: the asset must actually be in the requested domain.
  // We do this with a second query so we don't have to pull the registry
  // in here.
  const sparql = `
    SELECT ?asset WHERE {
      ?asset a ?t .
      FILTER(isIRI(?asset))
    }
    LIMIT 200
  `
  const allResult = await store.query(sparql)
  for (const row of allResult.results.bindings) {
    const iri = row['asset']?.value
    if (!iri) continue
    const md = await getAssetMetadata(iri)
    if (md.domain === domain && Object.keys(md.groups).length > 0) return iri
  }
  // Fall back to whatever the first query found, even if no group filled.
  return result.results.bindings[0]?.['asset']?.value ?? null
}

describe('metadata-index — per-asset facets', () => {
  it('discovers at least one shape group for an asset that has indexed properties', async () => {
    const picked = await pickDomainAndGroup()
    expect(picked).not.toBeNull()
    const iri = await pickAssetIri(picked!.domain)
    expect(iri).not.toBeNull()
    const md = await getAssetMetadata(iri!)
    expect(md.asset).toBe(iri)
    expect(md.domain.length).toBeGreaterThan(0)
    // At least one facet group present; values are bucketed under it.
    const groupNames = Object.keys(md.groups)
    expect(groupNames.length).toBeGreaterThan(0)
    // Every facet entry carries a non-empty value list (otherwise the
    // indexer would have skipped emitting it).
    for (const facets of Object.values(md.groups) as AssetMetadata['groups'][string][]) {
      for (const facet of facets) {
        expect(facet.values.length).toBeGreaterThan(0)
        expect(facet.property.length).toBeGreaterThan(0)
      }
    }
  }, 120_000)

  it('returns an empty groups map for an unknown / scheme-less identifier', async () => {
    // No SPARQL parse error must escape — the guard short-circuits.
    const md = await getAssetMetadata('not-a-real-iri-just-a-string')
    expect(md.asset).toBe('not-a-real-iri-just-a-string')
    expect(md.domain).toBe('')
    expect(md.groups).toEqual({})
  }, 30_000)
})

describe('metadata-index — domain aggregate', () => {
  it('returns per-property distribution stats for the picked group', async () => {
    const picked = await pickDomainAndGroup()
    expect(picked).not.toBeNull()
    const aggregate = await getDomainMetadataAggregate(picked!.domain, picked!.group)
    expect(aggregate.domain).toBe(picked!.domain)
    expect(aggregate.group).toBe(picked!.group)
    expect(aggregate.assetCount).toBeGreaterThan(0)
    expect(aggregate.properties.length).toBeGreaterThan(0)
    for (const prop of aggregate.properties) {
      expect(prop.property.length).toBeGreaterThan(0)
      expect(prop.totalValues).toBeGreaterThanOrEqual(0)
      expect(prop.distinctValues).toBeGreaterThanOrEqual(0)
      expect(prop.samples.length).toBeGreaterThanOrEqual(0)
    }
  }, 120_000)

  it('returns an empty result for a non-asset domain', async () => {
    const aggregate = await getDomainMetadataAggregate('definitely-not-a-domain', 'Quality')
    expect(aggregate.assetCount).toBe(0)
    expect(aggregate.properties).toEqual([])
  }, 30_000)
})

/** A (domain, group) whose facet has several properties, some with values. */
async function pickGroupOfSeveral(): Promise<{ domain: string; group: string }> {
  const [vocab, assetDomains] = await Promise.all([getCompilerVocab(), getAssetDomains()])
  for (const domain of [...assetDomains.keys()].sort()) {
    const sizes = new Map<string, number>()
    for (const { group } of shapeGroupFacets(vocab, domain)) {
      sizes.set(group, (sizes.get(group) ?? 0) + 1)
    }
    for (const [group, size] of [...sizes].sort(([a], [b]) => a.localeCompare(b))) {
      if (size < 2) continue
      const aggregate = await getDomainMetadataAggregate(domain, group)
      if (aggregate.properties.some((stats) => stats.totalValues > 0)) return { domain, group }
    }
  }
  throw new Error('no facet with several properties and values on the pinned ontology')
}

describe('metadata-index — domain aggregate in one query', () => {
  it('reads every property of the group in one query, next to the asset count', async () => {
    const { domain, group } = await pickGroupOfSeveral()
    const store = await getInitializedStore()
    const query = vi.spyOn(store, 'query')
    try {
      const aggregate = await getDomainMetadataAggregate(domain, group)
      expect(aggregate.properties.length).toBeGreaterThanOrEqual(2)
      expect(query).toHaveBeenCalledTimes(2)
      // The asset-class pattern opens every arm instead of joining the whole
      // union: Oxigraph evaluates that join quadratically in the assets.
      const values = new Parser().parse(String(query.mock.calls[1]?.[0])) as {
        where: { type: string }[]
      }
      expect(values.where.map((element) => element.type)).toEqual(['union', 'bind'])
    } finally {
      query.mockRestore()
    }
  }, 120_000)

  it('reports for every group what a query of each property alone reports', async () => {
    // The query the aggregate replaces, one per property, as the oracle.
    const [store, registry, vocab, assetDomains] = await Promise.all([
      getInitializedStore(),
      buildDomainRegistry(),
      getCompilerVocab(),
      getAssetDomains(),
    ])
    let compared = 0
    for (const domain of [...assetDomains.keys()].sort()) {
      const targetClass = registry.domains.get(domain)?.targetClassIri
      if (!targetClass) continue
      const facets = shapeGroupFacets(vocab, domain)
      for (const group of new Set(facets.map((facet) => facet.group))) {
        const expected = []
        for (const { key, path } of facets.filter((facet) => facet.group === group)) {
          const pathExpr = path.steps.map((step) => `<${step.predicate}>`).join('/')
          const rows = await store.query(`
            SELECT ?value (COUNT(?asset) AS ?count) ?datatype WHERE {
              ?asset a <${targetClass}> .
              ?asset ${pathExpr} ?value .
              BIND(DATATYPE(?value) AS ?datatype)
            }
            GROUP BY ?value ?datatype
          `)
          const counts = rows.results.bindings.flatMap((row) =>
            row['value']
              ? [
                  {
                    value: row['value'].value,
                    count: Number(row['count']?.value ?? '0'),
                    datatype: row['datatype']?.value,
                  },
                ]
              : []
          )
          expected.push(valueStats(key, counts))
        }
        const aggregate = await getDomainMetadataAggregate(domain, group)
        expect(aggregate.properties, `${domain} ${group}`).toEqual(expected)
        compared += expected.length
      }
    }
    expect(compared).toBeGreaterThan(0)
  }, 120_000)
})

describe('valueStats', () => {
  it('samples the most common values first, ties in value order', () => {
    const stats = valueStats('kind', [
      { value: 'b', count: 1 },
      { value: 'c', count: 3 },
      { value: 'a', count: 1 },
    ])
    expect(stats.samples).toEqual(['c', 'a', 'b'])
    expect(stats.totalValues).toBe(5)
    expect(stats.distinctValues).toBe(3)
  })

  it('reports a numeric range only when every value is numeric', () => {
    const integer = 'http://www.w3.org/2001/XMLSchema#integer'
    const string = 'http://www.w3.org/2001/XMLSchema#string'
    const numeric = [
      { value: '7', count: 1, datatype: integer },
      { value: '2', count: 2, datatype: integer },
    ]
    expect(valueStats('n', numeric).numericRange).toEqual({ min: 2, max: 7 })
    expect(
      valueStats('n', [...numeric, { value: 'x', count: 1, datatype: string }]).numericRange
    ).toBeUndefined()
  })
})
