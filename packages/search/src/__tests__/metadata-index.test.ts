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
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getAssetDomains } from '../asset-domains.js'
import { getCompilerVocab } from '../compiler.js'
import { getInitializedStore } from '../init.js'
import {
  type AssetMetadata,
  getAssetMetadata,
  getDomainMetadataAggregate,
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
 * Pick (domain, group) from the live shapeGroups index so the test
 * targets a real facet without hardcoding its name.
 */
async function pickDomainAndGroup(): Promise<{ domain: string; group: string } | null> {
  const [vocab, assetDomains] = await Promise.all([getCompilerVocab(), getAssetDomains()])
  for (const [key, group] of vocab.shapeGroups) {
    const propDomain = key.split(':')[1]
    if (!propDomain || !assetDomains.has(propDomain)) continue
    return { domain: propDomain, group }
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
