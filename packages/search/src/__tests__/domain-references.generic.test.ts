/**
 * Regression for W6a: cross-domain reference discovery is predicate-agnostic.
 *
 * `queryDomainReferences` used to require the reference property to be
 * `<manifestNamespace>hasReferencedArtifacts` (discovered by keying on a
 * "manifest" domain/prefix in the registry) — two ENVITED-X-specific literals.
 * It now recognizes a cross-domain reference structurally: ANY property whose
 * value resolves to a known asset class in a different domain (via `sh:class`
 * or a nested `sh:node → sh:or → sh:node → sh:targetClass` disjunction).
 *
 * This fixture declares the reference via a property named `alpha:relatedAssets`
 * (NOT `hasReferencedArtifacts`) and has no "manifest" domain at all, so the old
 * code discovered nothing (it early-returned when no manifest namespace was
 * found). The new code discovers alpha → beta. Fails before, passes after.
 */
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { queryDomainReferences } from '../schema-queries.js'

const ALPHA = 'http://example.org/alpha/v1/'
const BETA = 'http://example.org/beta/v1/'

// alpha:Widget references beta:Gadget through `alpha:relatedAssets`, whose
// value-shape is an sh:or disjunction of permitted referenced asset types —
// the open-IRI reference pattern, but under a non-manifest predicate name.
const FIXTURE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix alpha: <${ALPHA}> .
@prefix beta: <${BETA}> .

alpha:WidgetShape a sh:NodeShape ;
  sh:targetClass alpha:Widget ;
  sh:property [ sh:path alpha:relatedAssets ; sh:node alpha:RefWrapperShape ] .

alpha:RefWrapperShape a sh:NodeShape ;
  sh:or ( [ sh:node beta:GadgetShape ] ) .

beta:GadgetShape a sh:NodeShape ;
  sh:targetClass beta:Gadget .
`

describe('queryDomainReferences — predicate-agnostic cross-domain discovery (W6a)', () => {
  it('discovers a reference declared via a non-manifest predicate, with no manifest domain', async () => {
    const store = new OxigraphStore()
    await store.loadTurtle(FIXTURE_TTL, SCHEMA_GRAPH)

    const knownAssetClasses = new Set([`${ALPHA}Widget`, `${BETA}Gadget`])
    // No registry: extractDomain falls back to the `/<domain>/vN/` IRI convention.
    const refs = await queryDomainReferences(store, undefined, knownAssetClasses)

    expect(refs).toContainEqual({ parentDomain: 'alpha', childDomain: 'beta' })
  })

  it('does not invent references to non-asset classes', async () => {
    const store = new OxigraphStore()
    await store.loadTurtle(FIXTURE_TTL, SCHEMA_GRAPH)

    // beta:Gadget is NOT in the known asset set → the link must not be reported
    // (the filter is asset-class membership, not the predicate).
    const refs = await queryDomainReferences(store, undefined, new Set([`${ALPHA}Widget`]))
    expect(refs).toEqual([])
  })
})
