import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it } from 'vitest'

import { getInitializedStore } from '../init.js'
import { buildPropertyPaths } from '../property-paths.js'

describe('buildPropertyPaths', () => {
  it('returns at least one path per discovered leaf property', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)
    expect(paths.length).toBeGreaterThan(0)

    for (const path of paths) {
      expect(path.domain).toBeTruthy()
      expect(path.propertyName).toBeTruthy()
      expect(path.propertyIri).toMatch(/^https?:\/\//)
      expect(path.assetClass).toMatch(/^https?:\/\//)
      expect(path.steps.length).toBeGreaterThan(0)
      // The final step has no `intermediate`: it yields a literal.
      expect(path.steps[path.steps.length - 1]?.intermediate).toBeUndefined()
      // The final step's predicate IS the leaf property.
      expect(path.steps[path.steps.length - 1]?.predicate).toBe(path.propertyIri)
    }
  }, 120_000)

  /**
   * Regression: the discovery must reconstruct the ENVITED-X meta-model
   * path for hdmap's `roadTypes` (Content ⊂ DomainSpecification ⊂ HdMap)
   * without any hard-coded predicate name. This is the canonical use
   * case task 21 is designed to enable — once 21b rewires the compiler,
   * it'll consume exactly this chain instead of emitting literal
   * predicates from source.
   */
  it('reconstructs the hdmap→DomainSpecification→Content→roadTypes chain', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)

    const roadTypes = paths.find((p) => p.domain === 'hdmap' && p.propertyName === 'roadTypes')
    expect(roadTypes).toBeDefined()

    const predicateChain = roadTypes!.steps.map((s) => s.predicate)
    expect(predicateChain).toHaveLength(3)
    expect(predicateChain[0]).toMatch(/\/hasDomainSpecification$/)
    expect(predicateChain[1]).toMatch(/\/hasContent$/)
    expect(predicateChain[2]).toMatch(/\/roadTypes$/)

    // Intermediate target classes must be set on every non-leaf step.
    expect(roadTypes!.steps[0]?.intermediate).toMatch(/\/DomainSpecification$/)
    expect(roadTypes!.steps[1]?.intermediate).toMatch(/\/Content$/)
  }, 120_000)

  /**
   * Same shape rules for a different domain: scenario's `weatherSummary`
   * lives behind the same DomainSpecification → Content chain, but with
   * scenario-namespaced predicates. If the discovery only worked for
   * hdmap we'd silently miss the broader generic claim.
   */
  it('reconstructs the chain for a scenario-specific leaf property', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)

    const weatherSummary = paths.find(
      (p) => p.domain === 'scenario' && p.propertyName === 'weatherSummary'
    )
    expect(weatherSummary).toBeDefined()
    const chain = weatherSummary!.steps.map((s) => s.predicate)
    expect(chain[chain.length - 1]).toMatch(/\/weatherSummary$/)
    // Intermediate predicates live in the scenario namespace, NOT hdmap.
    expect(chain[0]).toMatch(/\/scenario\/v\d+\/hasDomainSpecification$/)
    // The asset class must be the scenario asset class, not hdmap.
    expect(weatherSummary!.assetClass).toMatch(/\/scenario\//)
  }, 120_000)

  /**
   * Inheritance: a SHACL shape targeting a superclass constrains the
   * subclass's instances (RDFS/SHACL semantics), so an asset class must
   * inherit its superclasses' property shapes. `tzip21:Asset` is
   * `rdfs:subClassOf gx:VirtualResource`, whose shape declares
   * `gx:resourcePolicy` directly — so it surfaces as a direct (single-hop)
   * property of the tzip21 domain. This path is reachable ONLY via
   * subClassOf, not via any composition (sh:node/sh:class) edge, so it
   * would not exist without inheritance-aware discovery.
   */
  it('inherits a superclass property shape via rdfs:subClassOf', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)

    const GX_RESOURCE_POLICY = 'https://w3id.org/gaia-x/development#resourcePolicy'
    const inherited = paths.find(
      (p) => p.domain === 'tzip21' && p.propertyIri === GX_RESOURCE_POLICY
    )
    expect(
      inherited,
      'tzip21 (rdfs:subClassOf gx:VirtualResource) must inherit gx:resourcePolicy'
    ).toBeDefined()
    // Declared directly on the superclass shape → a direct, single-hop property.
    expect(inherited!.steps).toHaveLength(1)
    expect(inherited!.steps[0]?.predicate).toBe(GX_RESOURCE_POLICY)
  }, 120_000)

  /**
   * Reachability check: every leaf property the compiler currently
   * emits should be reachable from at least one asset class. Without
   * this, the 21b rewire would silently drop properties that the
   * discovery doesn't find.
   */
  it('discovers paths for every domain that has an asset class', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)
    const reachableDomains = new Set(paths.map((p) => p.domain))
    // hdmap and scenario are the canonical asset domains in the workspace
    // ontology — the discovery must cover both.
    expect(reachableDomains.has('hdmap')).toBe(true)
    expect(reachableDomains.has('scenario')).toBe(true)
  }, 120_000)

  /**
   * Determinism: discovery is BFS-based, so each (assetClass, leaf)
   * pair should yield exactly one path. Re-running must produce the
   * same sequence — without this guarantee the eventual compiler
   * rewire (21b) would emit non-deterministic SPARQL.
   */
  it('is deterministic across repeated calls', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const a = await buildPropertyPaths(store, registry)
    const b = await buildPropertyPaths(store, registry)
    expect(b).toEqual(a)
  }, 120_000)
})
