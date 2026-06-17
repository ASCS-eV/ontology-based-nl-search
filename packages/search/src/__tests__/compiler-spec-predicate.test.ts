/**
 * Genericity regression: the asset → specification hop must come from the
 * schema's discovered property paths, never a hard-coded meta-model predicate.
 *
 * Drives the compiler through its `vocabIndex` + `registry` override seam with
 * a synthetic domain whose specification predicate is `widget:partOfSpec`
 * (deliberately NOT the ENVITED-X `hasDomainSpecification`). The filtered
 * property `alpha` has no discovered path of its own, which forces the
 * asset→spec fallback. A correct, ontology-agnostic compiler resolves that hop
 * from a sibling shape-group property (`beta`) that DOES have a path — using
 * the schema's real predicate. The previous implementation fabricated
 * `<prefix>:hasDomainSpecification` here, which this test forbids.
 */
import { describe, expect, it } from 'vitest'

import { compileSlotsWithTrace } from '../compiler.js'
import type { SearchSlots } from '../slots.js'

const NS = 'http://example.org/widget/v1/'

/** A minimal CompilerVocab: `alpha` is shape-group-classified but has no path;
 *  `beta` shares the same group and carries the real asset→spec predicate. */
function widgetVocab() {
  return {
    properties: new Map(),
    shapeGroups: new Map([
      ['alpha:widget', 'Detail'],
      ['beta:widget', 'Detail'],
    ]),
    shapeGroupPropertyNames: new Set(['alpha', 'beta']),
    range2DProperties: new Map(),
    paths: new Map([
      [
        'widget:beta',
        {
          domain: 'widget',
          propertyName: 'beta',
          propertyIri: NS + 'beta',
          assetClass: NS + 'Widget',
          steps: [
            { predicate: NS + 'partOfSpec', intermediate: NS + 'Spec' },
            { predicate: NS + 'hasDetail', intermediate: NS + 'Detail' },
            { predicate: NS + 'beta' },
          ],
        },
      ],
    ]),
    referenceChains: new Map(),
  }
}

/** A minimal DomainRegistry surface for the synthetic `widget` domain. */
function widgetRegistry() {
  const desc = {
    name: 'widget',
    namespace: NS,
    prefix: 'widget',
    targetClass: 'widget:Widget',
    targetClassIri: NS + 'Widget',
    version: 'v1',
    shapes: ['Widget'],
    declaredPrefixes: { widget: NS },
  }
  const domains = new Map([['widget', desc]])
  return {
    domains,
    domainNames: ['widget'],
    prefixesFor() {
      return `PREFIX widget: <${NS}>`
    },
    allPrefixes() {
      return this.prefixesFor()
    },
    resolveByIriDomain(d: string) {
      return d === 'widget' ? desc : undefined
    },
    domainForIri(iri: string) {
      return iri.startsWith(NS) ? 'widget' : undefined
    },
    getAllNamespaces() {
      return new Set([NS])
    },
  }
}

describe('compiler — asset→spec predicate is discovered, never hard-coded', () => {
  it('falls back to a sibling shape-group path rather than fabricating hasDomainSpecification', async () => {
    const slots: SearchSlots = { domains: ['widget'], filters: { alpha: 'x' }, ranges: {} }

    const { sparql } = await compileSlotsWithTrace(slots, {
      registry: widgetRegistry() as any,
      vocabIndex: widgetVocab() as any,
    })

    // The asset→spec hop uses the schema's real predicate, discovered from the
    // sibling property's path.
    expect(sparql).toContain('widget:partOfSpec')
    // It must NOT fabricate the ENVITED-X meta-model predicate.
    expect(sparql).not.toContain('hasDomainSpecification')
  })
})
