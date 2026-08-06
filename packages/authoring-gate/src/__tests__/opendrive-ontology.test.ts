import { Parser as N3Parser } from 'n3'
import { describe, expect, it } from 'vitest'

import {
  resolveOpenDriveRoadGrounding,
  resolveOpenDriveRoadGroundingFrom,
} from '../opendrive-ontology.js'

const NS = 'http://example.test/opendrive#'

/** A minimal fixture ontology shaped like ASAM's real OpenDRIVE OWL. */
const FIXTURE_TTL = `
@prefix odr: <${NS}> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

odr:T_road a owl:Class ;
    rdfs:label "t_road"@en .

odr:T_road.id a owl:DatatypeProperty ;
    rdfs:label "id"@en ;
    rdfs:domain odr:T_road ;
    rdfs:range xsd:string .

odr:T_road.junction a owl:DatatypeProperty ;
    rdfs:label "junction"@en ;
    rdfs:domain odr:T_road ;
    rdfs:range xsd:string .

odr:T_junction a owl:Class ;
    rdfs:label "t_junction"@en .

odr:T_junction.id a owl:DatatypeProperty ;
    rdfs:label "id"@en ;
    rdfs:domain odr:T_junction ;
    rdfs:range xsd:string .
`

describe('resolveOpenDriveRoadGroundingFrom', () => {
  it('resolves T_road (by label "t_road") and its id property (by domain + label)', () => {
    const quads = new N3Parser().parse(FIXTURE_TTL)
    const grounding = resolveOpenDriveRoadGroundingFrom(quads)
    expect(grounding.roadClassIri).toBe(`${NS}T_road`)
    expect(grounding.roadIdPropertyIri).toBe(`${NS}T_road.id`)
  })

  it('does not confuse T_road.id with T_junction.id (domain-scoped lookup)', () => {
    const quads = new N3Parser().parse(FIXTURE_TTL)
    const grounding = resolveOpenDriveRoadGroundingFrom(quads)
    expect(grounding.roadIdPropertyIri).not.toBe(`${NS}T_junction.id`)
  })

  it('throws a clear, actionable error when no class carries the "t_road" label (upstream drift)', () => {
    const drifted = FIXTURE_TTL.replace('"t_road"@en', '"t_road_renamed"@en')
    const quads = new N3Parser().parse(drifted)
    expect(() => resolveOpenDriveRoadGroundingFrom(quads)).toThrow(/t_road/)
  })

  /**
   * Resolution indexes the ontology rather than rescanning it per candidate,
   * so it must still pick the same declaration every time. Document order is
   * the tie-break if upstream ever ships two classes under one label.
   */
  it('resolves deterministically when a label is declared more than once', () => {
    const ambiguous = `${FIXTURE_TTL}
odr:T_road_duplicate a owl:Class ;
    rdfs:label "t_road"@en .
`
    const first = resolveOpenDriveRoadGroundingFrom(new N3Parser().parse(ambiguous))
    const second = resolveOpenDriveRoadGroundingFrom(new N3Parser().parse(ambiguous))
    expect(first.roadClassIri).toBe(`${NS}T_road`)
    expect(second.roadClassIri).toBe(first.roadClassIri)
  })

  it('throws a clear, actionable error when the road class has no "id" property (upstream drift)', () => {
    const drifted = FIXTURE_TTL.replace(
      `odr:T_road.id a owl:DatatypeProperty ;
    rdfs:label "id"@en ;
    rdfs:domain odr:T_road ;
    rdfs:range xsd:string .`,
      ''
    )
    const quads = new N3Parser().parse(drifted)
    expect(() => resolveOpenDriveRoadGroundingFrom(quads)).toThrow(/id/)
  })
})

describe('resolveOpenDriveRoadGrounding (against the real pinned OMB ontology)', () => {
  it('resolves real ASAM IRIs under the code.asam.net OpenDRIVE namespace', () => {
    const grounding = resolveOpenDriveRoadGrounding()
    expect(grounding.roadClassIri).toBe('http://code.asam.net/simulation/standard/opendrive#T_road')
    expect(grounding.roadIdPropertyIri).toBe(
      'http://code.asam.net/simulation/standard/opendrive#T_road.id'
    )
  })

  it('memoizes across calls (same object identity)', () => {
    expect(resolveOpenDriveRoadGrounding()).toBe(resolveOpenDriveRoadGrounding())
  })
})
