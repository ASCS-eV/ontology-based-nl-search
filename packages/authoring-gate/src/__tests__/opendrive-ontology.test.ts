import { Parser as N3Parser } from 'n3'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  resetOpenDriveRoadGroundingCache,
  resolveOpenDriveRoadGrounding,
  resolveOpenDriveRoadGroundingFrom,
} from '../opendrive-ontology.js'

const NS = 'http://code.asam.net/simulation/standard/opendrive'

/** A fixture shaped like ASAM's real OpenDRIVE OWL, reduced to what is asserted. */
const FIXTURE_TTL = `
@prefix odr: <${NS}#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

odr:T_road a owl:Class ;
    rdfs:label "t_road"@en .

odr:T_road.id a owl:DatatypeProperty ;
    rdfs:label "id"@en ;
    rdfs:domain odr:T_road ;
    rdfs:range xsd:string .

odr:T_junction.id a owl:DatatypeProperty ;
    rdfs:label "id"@en ;
    rdfs:domain odr:T_junction .
`

describe('resolveOpenDriveRoadGroundingFrom', () => {
  it('returns the ASAM IRIs when both entities are declared', () => {
    const grounding = resolveOpenDriveRoadGroundingFrom(new N3Parser().parse(FIXTURE_TTL))
    expect(grounding.roadClassIri).toBe(`${NS}#T_road`)
    expect(grounding.roadIdPropertyIri).toBe(`${NS}#T_road.id`)
  })

  /**
   * The point of resolving by IRI: `rdfs:label` is an annotation with no
   * uniqueness guarantee [RDFS] §3.6 — the real ontology declares
   * `rdfs:label "id"` on 35 entities — so a label carries no identity, and
   * changing one must not change what this check is grounded in.
   */
  it('is unaffected by relabelling, because a label is not an identifier', () => {
    const relabelled = FIXTURE_TTL.replace('"t_road"@en', '"something else entirely"@en')
    const grounding = resolveOpenDriveRoadGroundingFrom(new N3Parser().parse(relabelled))
    expect(grounding.roadClassIri).toBe(`${NS}#T_road`)
  })

  it('throws an actionable error when the class is renamed upstream', () => {
    const drifted = FIXTURE_TTL.replace('odr:T_road a owl:Class', 'odr:T_roadway a owl:Class')
    expect(() => resolveOpenDriveRoadGroundingFrom(new N3Parser().parse(drifted))).toThrow(
      /T_road>? is not declared as an owl:Class/
    )
  })

  it('throws an actionable error when the id property is renamed upstream', () => {
    const drifted = FIXTURE_TTL.replace(
      'odr:T_road.id a owl:DatatypeProperty',
      'odr:T_road.ident a owl:DatatypeProperty'
    )
    expect(() => resolveOpenDriveRoadGroundingFrom(new N3Parser().parse(drifted))).toThrow(
      /T_road\.id/
    )
  })

  /**
   * A declaration of the wrong kind is drift too: if `T_road.id` ever became
   * an object property, the cross-file query's literal comparison would stop
   * matching and the check would silently pass everything.
   */
  it('throws when an entity exists but is declared as the wrong kind', () => {
    const drifted = FIXTURE_TTL.replace(
      'odr:T_road.id a owl:DatatypeProperty',
      'odr:T_road.id a owl:ObjectProperty'
    )
    expect(() => resolveOpenDriveRoadGroundingFrom(new N3Parser().parse(drifted))).toThrow(
      /owl:DatatypeProperty/
    )
  })
})

describe('resolveOpenDriveRoadGrounding (against the real pinned ontology)', () => {
  beforeEach(() => resetOpenDriveRoadGroundingCache())

  it('resolves the ontology through the pinned OASIS catalog, not a hardcoded path', async () => {
    const grounding = await resolveOpenDriveRoadGrounding()
    expect(grounding.roadClassIri).toBe(`${NS}#T_road`)
    expect(grounding.roadIdPropertyIri).toBe(`${NS}#T_road.id`)
  })

  it('memoizes across calls (same object identity)', async () => {
    expect(await resolveOpenDriveRoadGrounding()).toBe(await resolveOpenDriveRoadGrounding())
  })

  /**
   * Warmup and a first request can race. Memoizing the promise rather than
   * only the value means concurrent callers share one read+parse of a 423 KB
   * document instead of each doing their own.
   */
  it('resolves once under concurrent callers', async () => {
    const [a, b, c] = await Promise.all([
      resolveOpenDriveRoadGrounding(),
      resolveOpenDriveRoadGrounding(),
      resolveOpenDriveRoadGrounding(),
    ])
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})
