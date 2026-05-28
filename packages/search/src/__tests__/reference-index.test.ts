/**
 * Reference-index integration tests (WP3, task #17).
 *
 * The index must:
 *   1. Discover every link between two typed asset classes that exists
 *      in the loaded instance data — independently of whether the SHACL
 *      declares the chain (the data-driven complement to
 *      `buildReferenceChains`).
 *   2. Aggregate by (sourceClass, predicatePath, targetClass) signature
 *      so multiple instance pairs of the same shape collapse into one
 *      edge with a sample count.
 *   3. Be ontology-agnostic — the test asserts behaviour against the
 *      live workspace ontology but never hardcodes which ontology that
 *      is. Concrete identifiers (`ositrace`, `hdmap`) appear only in
 *      the assertion narrative, not in the discovery logic under test.
 *
 * Runs against the real workspace store via `getInitializedStore`. The
 * cold-start cost is shared with the other integration tests in this
 * package via the singleton store + cached registry.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { getAssetDomains } from '../compiler.js'
import { getInitializedStore } from '../init.js'
import { getReferenceIndex, resetReferenceIndex } from '../reference-index.js'

beforeAll(async () => {
  // The store-level singleton populates registry / asset-domain caches the
  // index relies on. Avoid cold-start spillover into the first test.
  await getInitializedStore()
  // Force a fresh index for this suite so we measure the build, not a
  // pre-warmed singleton from earlier tests in the run.
  resetReferenceIndex()
}, 120_000)

describe('reference index — data-driven discovery', () => {
  it('discovers at least one link between two distinct asset domains', async () => {
    const index = await getReferenceIndex()
    let totalEdges = 0
    let crossDomainEdges = 0
    for (const edges of index.values()) {
      for (const edge of edges) {
        totalEdges++
        if (edge.sourceDomain !== edge.targetDomain) crossDomainEdges++
      }
    }
    expect(totalEdges).toBeGreaterThan(0)
    expect(crossDomainEdges).toBeGreaterThan(0)
  }, 120_000)

  it('only records edges whose endpoints are both asset domains', async () => {
    const index = await getReferenceIndex()
    const assetDomains = await getAssetDomains()
    for (const [sourceDomain, edges] of index) {
      expect(assetDomains.has(sourceDomain)).toBe(true)
      for (const edge of edges) {
        expect(edge.sourceDomain).toBe(sourceDomain)
        expect(assetDomains.has(edge.targetDomain)).toBe(true)
      }
    }
  }, 120_000)

  it('never produces self-loops (source class === target class)', async () => {
    const index = await getReferenceIndex()
    for (const edges of index.values()) {
      for (const edge of edges) {
        expect(edge.sourceClass).not.toBe(edge.targetClass)
      }
    }
  }, 120_000)

  it('records a non-empty predicate path with positive sample counts', async () => {
    const index = await getReferenceIndex()
    for (const edges of index.values()) {
      for (const edge of edges) {
        expect(edge.predicatePath.length).toBeGreaterThan(0)
        expect(edge.sampleCount).toBeGreaterThan(0)
      }
    }
  }, 120_000)

  /**
   * Regression: the WP3 motivating case. The data has 50/53 ositraces
   * with `manifest:hasReferencedArtifacts` pointing to hdmap IRIs;
   * the SHACL doesn't declare this chain inline on ositrace (it
   * inherits it via the shared manifest:ManifestShape), so the
   * SHACL-only `buildReferenceChains` discovery misses it. The data
   * index must surface the link regardless.
   */
  it('surfaces the ositrace → hdmap link the SHACL-only discovery misses', async () => {
    const index = await getReferenceIndex()
    const ositraceEdges = index.get('ositrace') ?? []
    const toHdmap = ositraceEdges.find((e) => e.targetDomain === 'hdmap')
    expect(toHdmap).toBeDefined()
    expect(toHdmap!.predicatePath.length).toBeGreaterThanOrEqual(1)
    // The fixture has 50 of 53 ositraces wired up to hdmaps.
    expect(toHdmap!.sampleCount).toBeGreaterThanOrEqual(10)
  }, 120_000)

  /**
   * Acceptance criterion #1 lower bound: the registry must surface
   * links touching at least three distinct asset domains. This is a
   * generic check — any three domains, derived from the live
   * registry, satisfy it.
   */
  it('covers at least three distinct asset domains across the link graph', async () => {
    const index = await getReferenceIndex()
    const involved = new Set<string>()
    for (const [sourceDomain, edges] of index) {
      involved.add(sourceDomain)
      for (const e of edges) involved.add(e.targetDomain)
    }
    expect(involved.size).toBeGreaterThanOrEqual(3)
  }, 120_000)

  /**
   * Determinism: the build is read-only, so two consecutive calls
   * return the same singleton.
   */
  it('returns a stable singleton across consecutive calls', async () => {
    const a = await getReferenceIndex()
    const b = await getReferenceIndex()
    expect(b).toBe(a)
  }, 120_000)
})
