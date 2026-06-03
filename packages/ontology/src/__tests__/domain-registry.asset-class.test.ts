/**
 * Regression for the genericity keystone: primary-asset-class selection is
 * graph-driven (rdfs:subClassOf parsed with a real RDF parser), NOT a name
 * match plus a hard-coded list of ENVITED-X sub-shape names.
 *
 * The fixture below is deliberately adversarial to the OLD heuristic:
 *
 *  - The asset class is NOT named after its domain (`alpha` → `Widget`, not
 *    `Alpha`), so the PascalCase match fails.
 *  - A sub-component shape (`WidgetPart`) is declared BEFORE the asset shape,
 *    so the old "first target class that isn't a known sub-shape" fallback —
 *    which only excluded the literal ENVITED-X names — would have picked the
 *    sub-component `WidgetPart`.
 *  - The asset's superclass is declared through a blank-node `owl:Restriction`
 *    interleaved with the named super, mirroring the upstream Gaia-X OWL that
 *    defeats a regex extractor. The n3-based parse must still see the named
 *    `found:Resource` super.
 *
 * The rule classifies `found:Part` as a component-base (a bare root subclassed
 * by ≥2 domains) and `found:Resource` as an asset base (it has its own super),
 * so `Widget`/`Gadget` (subclasses of the asset base) win over the
 * `WidgetPart`/`GadgetPart` sub-components. Fails on the pre-keystone registry
 * (which selects `alpha:WidgetPart`); passes on the graph-driven one.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resetConfig } from '@ontology-search/core/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildDomainRegistry, resetDomainRegistry } from '../domain-registry.js'

const NS = 'http://example.org'

/** A domain whose asset class is `<Asset>` and sub-component is `<Asset>Part`. */
function writeDomain(root: string, dir: string, prefix: string, assetLocal: string): void {
  const domainDir = join(root, dir)
  mkdirSync(domainDir, { recursive: true })
  const ns = `${NS}/${dir}/v1/`
  const foundNs = `${NS}/foundation/v1/`

  // SHACL: declare the SUB-COMPONENT shape FIRST so a "first target class"
  // fallback would wrongly pick it.
  writeFileSync(
    join(domainDir, `${dir}.shacl.ttl`),
    `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ${prefix}: <${ns}> .

${prefix}:${assetLocal}PartShape a sh:NodeShape ; sh:targetClass ${prefix}:${assetLocal}Part .
${prefix}:${assetLocal}Shape a sh:NodeShape ; sh:targetClass ${prefix}:${assetLocal} .
`
  )

  // OWL: the asset subclasses the shared asset base (which has its own super);
  // the sub-component subclasses the shared component base (a bare root). The
  // asset also carries a blank-node owl:Restriction super, as upstream OWL does.
  writeFileSync(
    join(domainDir, `${dir}.owl.ttl`),
    `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ${prefix}: <${ns}> .
@prefix found: <${foundNs}> .

found:Resource a owl:Class ; rdfs:subClassOf owl:Thing .
found:Part a owl:Class .

${prefix}:${assetLocal} a owl:Class ;
    rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ${prefix}:p ; owl:someValuesFrom owl:Thing ] ;
    rdfs:subClassOf found:Resource .
${prefix}:${assetLocal}Part a owl:Class ; rdfs:subClassOf found:Part .
`
  )
}

describe('primary-asset-class selection — graph-driven (no name list)', () => {
  let workspaceRoot: string

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'asset-class-test-'))
    // Two domains so the shared bases are subclassed by ≥2 domains.
    writeDomain(workspaceRoot, 'alpha', 'alpha', 'Widget')
    writeDomain(workspaceRoot, 'beta', 'beta', 'Gadget')
    writeFileSync(
      join(workspaceRoot, 'ontology-sources.json'),
      JSON.stringify({ sources: [{ path: '.' }] })
    )
    process.env['ONTOLOGY_ROOT'] = workspaceRoot
    resetConfig()
    resetDomainRegistry()
  })

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true })
    delete process.env['ONTOLOGY_ROOT']
    resetConfig()
    resetDomainRegistry()
  })

  it('selects the asset-base subclass, not the name match or the first-declared sub-component', async () => {
    const registry = await buildDomainRegistry()

    const alpha = registry.domains.get('alpha')
    const beta = registry.domains.get('beta')
    expect(alpha, 'alpha domain should be discovered').toBeDefined()
    expect(beta, 'beta domain should be discovered').toBeDefined()

    // The graph rule picks the asset (subclass of found:Resource), even though
    // it is not named after the domain and is declared after the sub-component,
    // and even though its named super sits beside a blank-node restriction.
    expect(alpha!.targetClass).toBe('alpha:Widget')
    expect(beta!.targetClass).toBe('beta:Gadget')

    // And specifically NOT the sub-component the old first-non-sub-shape
    // fallback would have chosen.
    expect(alpha!.targetClass).not.toBe('alpha:WidgetPart')
    expect(beta!.targetClass).not.toBe('beta:GadgetPart')
  })
})
