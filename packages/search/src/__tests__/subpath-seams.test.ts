/**
 * Guards the discovery / lineage subpath seam (ADR 0003, step 4).
 *
 * The `@ontology-search/search/discovery` and `/lineage` barrels make the
 * package's internal seams importable on their own. These tests pin the
 * runtime (value) surface of each barrel and assert the seam is a real
 * partition — no symbol leaks across it — so the barrels can't silently drift
 * into each other or lose an export.
 */
import { describe, expect, it } from 'vitest'

import * as discovery from '../discovery.js'
import * as lineage from '../lineage.js'

const DISCOVERY_EXPORTS = [
  'getAssetDomains',
  'resetAssetDomains',
  'buildConceptExpansionIndex',
  'expandConceptValue',
  'expandFilterConcepts',
  'getConceptExpansionIndex',
  'resetConceptExpansionIndex',
  'buildPropertyPaths',
  'buildReferenceChains',
  'SCHEMA_GRAPH',
  'extractSchemaVocabulary',
  'getInstanceValues',
  'resetVocabulary',
] as const

const LINEAGE_EXPORTS = [
  'getAssetMetadata',
  'getDomainMetadataAggregate',
  'getReferenceIndex',
  'resetReferenceIndex',
  'DEFAULT_LINEAGE_DEPTH',
  'exploreLineage',
  'MAX_LINEAGE_DEPTH',
] as const

describe('search subpath seams', () => {
  // Asserting set EQUALITY (not just "every listed symbol is defined") makes the
  // guard symmetric: it fails both when an expected export is removed/renamed AND
  // when a new value export is added to the barrel without updating this list —
  // forcing a deliberate review of the seam's surface. `Object.keys` returns only
  // value exports; `export type` members erase at runtime and are intentionally
  // out of scope here.
  it('discovery barrel exposes exactly its expected runtime surface', () => {
    expect(Object.keys(discovery).sort()).toEqual([...DISCOVERY_EXPORTS].sort())
  })

  it('lineage barrel exposes exactly its expected runtime surface', () => {
    expect(Object.keys(lineage).sort()).toEqual([...LINEAGE_EXPORTS].sort())
  })

  it('discovery and lineage are a disjoint partition — no symbol leaks across the seam', () => {
    const discoveryKeys = new Set(Object.keys(discovery))
    const overlap = Object.keys(lineage).filter((k) => discoveryKeys.has(k))
    expect(overlap).toEqual([])
  })
})
