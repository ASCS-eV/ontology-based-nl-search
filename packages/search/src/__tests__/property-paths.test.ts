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
   * Regression: OpenLABEL's ODD category shapes (OddEnvironment / OddScenery /
   * OddDynamicElements) are empty and defer to the flat `OddShape` on their
   * superclass `Odd` ([SHACL] §2.1.3.2, §1.1). Nested under scenario's
   * `hasContent` union, their properties used to be invisible.
   */
  it('inherits superclass-shape leaves for classes nested via sh:node', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)
    for (const domain of ['scenario', 'hdmap']) {
      const odd = paths.find((p) => p.domain === domain && p.propertyName === 'DrivableAreaType')
      expect(odd, `${domain} must expose DrivableAreaType`).toBeDefined()
      expect(odd!.steps.map((s) => s.predicate)).toEqual([
        expect.stringMatching(/\/hasDomainSpecification$/),
        expect.stringMatching(/\/hasContent$/),
        odd!.propertyIri,
      ])
    }
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
   * One class used under several properties: the scenario's motion
   * behaviour bounds share one value class behind three predicates. Each
   * route is a different sequence path from the asset ([SHACL] §2.3.1.2);
   * keeping only the shortest attributed every bound to the first motion
   * property and left the others unsearchable.
   */
  it('reaches a class used under several properties through each of them', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)

    const hops = paths
      .filter((p) => p.domain === 'scenario' && p.propertyName === 'maxValue')
      .map((p) => p.steps.at(-2)!.predicate.split('/').pop())
    expect(hops.sort()).toEqual([
      'motionAccelerateValue',
      'motionDecelerateValue',
      'motionDriveValue',
    ])
  }, 120_000)

  /**
   * Determinism: re-running must produce the same paths in the same
   * order — without this guarantee the compiler would emit
   * non-deterministic SPARQL.
   */
  it('is deterministic across repeated calls', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const a = await buildPropertyPaths(store, registry)
    const b = await buildPropertyPaths(store, registry)
    expect(b).toEqual(a)
  }, 120_000)
})
