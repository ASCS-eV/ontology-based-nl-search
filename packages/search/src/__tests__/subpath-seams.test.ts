/**
 * Guards what `@ontology-search/search` exposes — the root barrel and the
 * discovery / lineage subpath seams (ADR 0003, step 4).
 *
 * Two things are pinned here. Each barrel's runtime surface is asserted by set
 * EQUALITY, so the guard is symmetric: it fails both when an expected export is
 * removed or renamed AND when a new value export is added without a deliberate
 * edit to these lists. And no entry point may expose a `reset*` cache hook —
 * those exist for tests, and shipping a way to clear process-wide caches as
 * part of the public contract invites a caller to do exactly that. Tests reach
 * them through their own modules, which is where a test seam belongs.
 *
 * `Object.keys` returns only value exports; `export type` members erase at
 * runtime and are intentionally out of scope.
 */
import { describe, expect, it } from 'vitest'

import * as discovery from '../discovery.js'
import * as root from '../index.js'
import * as lineage from '../lineage.js'

const ROOT_EXPORTS = [
  'DEFAULT_LINEAGE_DEPTH',
  'MAX_LINEAGE_DEPTH',
  'SCHEMA_GRAPH',
  'SearchService',
  'buildPropertyPaths',
  'buildReferenceChains',
  'buildTermIndex',
  'compileAllCountQueries',
  'compileCountQuery',
  'compileSlots',
  'compileSlotsWithTrace',
  'expandFilterConcepts',
  'exploreLineage',
  'extractSchemaVocabulary',
  'extractShaclFragments',
  'getAssetDomains',
  'getAssetMetadata',
  'getConceptExpansionIndex',
  'getDomainMetadataAggregate',
  'getInitializedStore',
  'getInstanceValues',
  'preferDomainsNamedInQuery',
  'rankCards',
  'renderDistilledCards',
  'retrieveRelevantSchema',
  'toVocabularyResponse',
  'tokenize',
  'validateSparql',
  'warmupCompiler',
  'warmupRetrievalIndex',
] as const

const DISCOVERY_EXPORTS = [
  'getAssetDomains',
  'expandFilterConcepts',
  'getConceptExpansionIndex',
  'buildPropertyPaths',
  'buildReferenceChains',
  'SCHEMA_GRAPH',
  'extractSchemaVocabulary',
  'getInstanceValues',
] as const

const LINEAGE_EXPORTS = [
  'getAssetMetadata',
  'getDomainMetadataAggregate',
  'DEFAULT_LINEAGE_DEPTH',
  'exploreLineage',
  'MAX_LINEAGE_DEPTH',
] as const

const ENTRY_POINTS = {
  '.': [root, ROOT_EXPORTS],
  './discovery': [discovery, DISCOVERY_EXPORTS],
  './lineage': [lineage, LINEAGE_EXPORTS],
} as const

describe('search public surface', () => {
  it.each(Object.entries(ENTRY_POINTS))(
    '%s exposes exactly its expected runtime surface',
    (_subpath, [moduleNamespace, expected]) => {
      expect(Object.keys(moduleNamespace).sort()).toEqual([...expected].sort())
    }
  )

  it.each(Object.entries(ENTRY_POINTS))(
    '%s exposes no reset* cache hook — those are test seams, not contract',
    (_subpath, [moduleNamespace]) => {
      expect(Object.keys(moduleNamespace).filter((n) => n.startsWith('reset'))).toEqual([])
    }
  )

  it('discovery and lineage are a disjoint partition — no symbol leaks across the seam', () => {
    const discoveryKeys = new Set(Object.keys(discovery))
    expect(Object.keys(lineage).filter((k) => discoveryKeys.has(k))).toEqual([])
  })

  /**
   * The subpaths are a partition OF the root surface: anything they expose must
   * also be reachable from `.`, or a consumer following the root barrel would
   * silently miss part of the package.
   */
  it('every subpath export is also reachable from the root barrel', () => {
    const rootKeys = new Set(Object.keys(root))
    const missing = [...Object.keys(discovery), ...Object.keys(lineage)].filter(
      (k) => !rootKeys.has(k)
    )
    expect(missing).toEqual([])
  })
})
