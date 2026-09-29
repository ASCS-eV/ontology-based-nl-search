/**
 * Extended property paths on the pinned ontology: they add the properties
 * the plain discovery missed, and change nothing the compiler resolved before.
 *
 * The compiler resolves a property by local name across domains — the owners
 * of a name, the cross-domain OPTIONAL for a domain-less filter, and the
 * validator's domain correction all read every domain's paths — so a new
 * path for a name another domain already resolves would change those queries.
 * The cases below are the ones that did change while extended paths were
 * only kept apart per (domain, name).
 */
import { describe, expect, it } from 'vitest'

import { compileSlots, getCompilerVocab } from '../compiler.js'

const localName = (iri: string) => iri.split(/[/#]/).pop()

describe('extended property paths on the pinned ontology', () => {
  it('give HD maps the lane count OpenLABEL declares on its ODD superclass', async () => {
    const vocab = await getCompilerVocab()
    const lane = [...vocab.paths.values()].find(
      (p) => p.domain === 'hdmap' && p.propertyName === 'laneSpecificationLaneCountValue'
    )
    expect(lane?.extended).toBe(true)
    expect(lane?.steps.map((s) => localName(s.predicate))).toEqual([
      'hasDomainSpecification',
      'hasContent',
      'laneSpecificationLaneCountValue',
    ])
  }, 120_000)

  it('never carry a name that a plain path or a shape group already resolves', async () => {
    const vocab = await getCompilerVocab()
    const all = [...vocab.paths.values()]
    const plainNames = new Set(all.filter((p) => !p.extended).map((p) => p.propertyName))
    const clashes = all
      .filter((p) => p.extended)
      .filter(
        (p) => plainNames.has(p.propertyName) || vocab.shapeGroupPropertyNames.has(p.propertyName)
      )
      .map((p) => `${p.domain}:${p.propertyName}`)
    expect(clashes).toEqual([])
  }, 120_000)

  it('leave a domain-less filter on the domain that already resolved it', async () => {
    // A scenario tag, also reachable from HD maps through inheritance.
    const sparql = await compileSlots({ domains: [], filters: { MotionCutIn: 'true' }, ranges: {} })
    expect(sparql).toMatch(/\?asset scenario:hasDomainSpecification /)
    expect(sparql).not.toMatch(/hdmap:hasContent/)
  }, 120_000)

  it('add no UNION arm for a domain that only an inherited path would reach', async () => {
    // `region` resolves for HD maps; a service reaches a same-named leaf only
    // through an inherited provider address, which must not become an arm.
    const sparql = await compileSlots({
      domains: ['hdmap', 'service'],
      filters: { region: 'Bavaria' },
      ranges: {},
    })
    expect(sparql).toMatch(/georeference:region/)
    expect(sparql).not.toMatch(/service:|\/service\//)
  }, 120_000)
})
