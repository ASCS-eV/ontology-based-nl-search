/**
 * Reference-index integration tests.
 *
 * The index must:
 *   1. Derive every declared link between two asset classes from the
 *      SHAPES graph alone — including chains a domain only inherits
 *      through a shared shape, which the compiler's leaf-path discovery
 *      collapses away.
 *   2. Preserve gap detection: a declared reference type appears whether
 *      or not any instance uses it, and building the index never touches
 *      the instance graph.
 *   3. Be ontology-agnostic — the test asserts behaviour against the
 *      live workspace ontology but never hardcodes which ontology that
 *      is. Concrete identifiers (`ositrace`, `hdmap`) appear only in
 *      the regression narrative, not in the discovery logic under test.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { getAssetDomains } from '../asset-domains.js'
import { getInitializedStore } from '../init.js'
import {
  getReferenceIndex,
  pickLiveReferenceEdge,
  resetReferenceIndex,
} from '../reference-index.js'

beforeAll(async () => {
  // The store-level singleton populates registry / asset-domain caches the
  // index relies on. Avoid cold-start spillover into the first test.
  await getInitializedStore()
  // Force a fresh index for this suite so we measure the build, not a
  // pre-warmed singleton from earlier tests in the run.
  resetReferenceIndex()
}, 120_000)

describe('reference index — schema-derived discovery', () => {
  it('derives at least one link between two distinct asset domains', async () => {
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

  it('records a non-empty, depth-bounded predicate path on every edge', async () => {
    const index = await getReferenceIndex()
    for (const edges of index.values()) {
      for (const edge of edges) {
        expect(edge.predicatePath.length).toBeGreaterThan(0)
        expect(edge.predicatePath.length).toBeLessThanOrEqual(6)
      }
    }
  }, 120_000)

  /**
   * Gap preservation: an open (IRI-leaf) reference chain is declared to
   * reach ANY asset — so every other asset domain must appear as a
   * target, including ones no loaded instance links to yet. That missing
   * link is exactly the data gap the product surfaces.
   */
  it('fans an open reference chain out to every other asset domain', async () => {
    const index = await getReferenceIndex()
    const assetDomains = await getAssetDomains()

    let sawFullFanOut = false
    for (const [sourceDomain, edges] of index) {
      const targets = new Set(edges.map((e) => e.targetDomain))
      const others = [...assetDomains].filter((d) => d !== sourceDomain)
      if (others.length > 1 && others.every((d) => targets.has(d))) {
        sawFullFanOut = true
        break
      }
    }
    expect(sawFullFanOut).toBe(true)
  }, 120_000)

  /**
   * Regression: the motivating case. ositrace inherits its outbound link
   * chain from a shared manifest shape, so the SHACL leaf-path discovery
   * (`buildReferenceChains`) never surfaces it as a typed leaf — and the
   * old instance-BFS index only saw it because sample data happened to
   * populate it. The shape walk must declare it unconditionally.
   */
  it('surfaces the ositrace → hdmap chain inherited via the shared manifest shape', async () => {
    const index = await getReferenceIndex()
    const ositraceEdges = index.get('ositrace') ?? []
    const toHdmap = ositraceEdges.find((e) => e.targetDomain === 'hdmap')
    expect(toHdmap).toBeDefined()
    expect(toHdmap!.predicatePath.length).toBeGreaterThanOrEqual(1)
  }, 120_000)

  /**
   * Acceptance lower bound: the graph must link at least three distinct
   * asset domains. Generic — any three domains, derived from the live
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
   * Live selection: several declared spellings can connect the same two
   * domains, and the shortest one is not necessarily what instances use.
   * The picker must probe candidates against the data and return the
   * populated chain — for the sample data, the ositrace → hdmap link
   * rides the manifest indirection, not the shorter declared spellings.
   */
  it('pickLiveReferenceEdge returns the chain the data actually populates', async () => {
    const store = await getInitializedStore()
    const index = await getReferenceIndex()
    const edge = await pickLiveReferenceEdge(store, index, 'ositrace', 'hdmap')
    expect(edge).toBeDefined()

    const probe = await store.query(`
      SELECT ?s WHERE {
        ?s a <${edge!.sourceClass}> .
        ?s ${edge!.predicatePath.map((p) => `<${p}>`).join('/')} ?t .
        ?t a <${edge!.targetClass}> .
      }
      LIMIT 1
    `)
    expect(probe.results.bindings.length).toBe(1)
  }, 120_000)

  it('pickLiveReferenceEdge falls back to the shortest declared edge for unpopulated pairs', async () => {
    const store = await getInitializedStore()
    const index = await getReferenceIndex()
    // Find a declared pair with no data behind ANY candidate.
    let unpopulated: { parent: string; child: string } | null = null
    outer: for (const [parent, edges] of index) {
      for (const edge of edges) {
        const probe = await store.query(`
          SELECT ?s WHERE {
            ?s a <${edge.sourceClass}> .
            ?s ${edge.predicatePath.map((p) => `<${p}>`).join('/')} ?t .
            ?t a <${edge.targetClass}> .
          }
          LIMIT 1
        `)
        if (probe.results.bindings.length === 0) {
          const siblings = edges.filter((e) => e.targetDomain === edge.targetDomain)
          if (siblings.length > 0) {
            unpopulated = { parent, child: edge.targetDomain }
            break outer
          }
        }
      }
    }
    expect(unpopulated, 'sample data populates every declared pair?').not.toBeNull()

    const edge = await pickLiveReferenceEdge(store, index, unpopulated!.parent, unpopulated!.child)
    // A declared edge is still returned — the honest JOIN whose empty
    // result IS the data gap.
    expect(edge).not.toBeNull()
    expect(edge!.targetDomain).toBe(unpopulated!.child)
  }, 120_000)

  it('is deterministic: a rebuilt index has identical edges in identical order', async () => {
    const first = await getReferenceIndex()
    resetReferenceIndex()
    const second = await getReferenceIndex()
    expect(second).toEqual(first)
  }, 120_000)

  it('returns a stable singleton across consecutive calls', async () => {
    const a = await getReferenceIndex()
    const b = await getReferenceIndex()
    expect(b).toBe(a)
  }, 120_000)
})
