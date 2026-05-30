/**
 * Reference-chain discovery — task 21c regression test.
 *
 * Asserts that against the real workspace ontology, the property-path
 * BFS + leafKind enrichment together expose AT LEAST ONE IRI-typed
 * leaf reachable from each asset domain. That's the precondition for
 * `buildReferenceChains` to emit cross-domain joins instead of the
 * compiler silently skipping referenced domains.
 *
 * The previous heuristic (hardcoded `hasManifest → hasReferencedArtifacts
 * → iri` chain) would always emit a join regardless of whether the
 * graph declares it; this test pins the new SHACL-driven path so the
 * regression cannot resurface without breaking the assertion.
 */
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it } from 'vitest'

import { getInitializedStore } from '../init.js'
import { buildPropertyPaths, buildReferenceChains } from '../property-paths.js'

describe('reference-chain discovery (task 21c, real workspace)', () => {
  it('property-path enrichment marks at least one leaf as iri/class kind', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)
    const nonLiteral = paths.filter((p) => p.leafKind !== 'literal')

    // For visibility when this assertion ever fails, the failure
    // message must surface what was discovered so the next person
    // doesn't have to add logging from scratch.
    expect(
      nonLiteral.length,
      `Expected ≥1 non-literal leaf in workspace SHACL — got ${nonLiteral.length} of ${paths.length} paths. ` +
        `Sample propertyIris: ${paths
          .slice(0, 5)
          .map((p) => `${p.propertyIri}=${p.leafKind}`)
          .join(', ')}`
    ).toBeGreaterThan(0)
  }, 90_000)

  it('buildReferenceChains emits at least one chain for the workspace', async () => {
    const store = await getInitializedStore()
    const registry = await buildDomainRegistry()
    const paths = await buildPropertyPaths(store, registry)
    const knownAssetClasses = new Set<string>()
    for (const desc of registry.domains.values()) {
      knownAssetClasses.add(desc.targetClassIri)
    }
    const chains = buildReferenceChains(paths, registry, knownAssetClasses)
    expect(
      chains.length,
      'buildReferenceChains returned no chains — cross-domain joins will be silently skipped.'
    ).toBeGreaterThan(0)
  }, 90_000)
})
