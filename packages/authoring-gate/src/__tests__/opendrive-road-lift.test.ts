import { beforeAll, describe, expect, it } from 'vitest'

import {
  type OpenDriveRoadGrounding,
  resolveOpenDriveRoadGrounding,
} from '../opendrive-ontology.js'
import { liftOpenDriveRoadFacts } from '../opendrive-road-lift.js'
import { CONTINUOUS_XODR, NO_ROAD_ONE_XODR } from './fixtures/xodr.js'

let grounding: OpenDriveRoadGrounding

beforeAll(async () => {
  grounding = await resolveOpenDriveRoadGrounding()
})

describe('liftOpenDriveRoadFacts', () => {
  it('emits a fact for the top-level road, typed and keyed by the REAL ASAM ontology IRIs', () => {
    const ttl = liftOpenDriveRoadFacts(CONTINUOUS_XODR, grounding)
    expect(ttl).toContain(`a <${grounding.roadClassIri}>`)
    expect(ttl).toContain(`<${grounding.roadIdPropertyIri}> "1"`)
  })

  it('emits the id declared by a differently-numbered road network', () => {
    const ttl = liftOpenDriveRoadFacts(NO_ROAD_ONE_XODR, grounding)
    expect(ttl).toContain(`<${grounding.roadIdPropertyIri}> "5"`)
    expect(ttl).not.toContain(`<${grounding.roadIdPropertyIri}> "1"`)
  })

  it('returns a well-formed empty document (no throw) for malformed XML', () => {
    expect(() => liftOpenDriveRoadFacts('<not-xml', grounding)).not.toThrow()
  })

  it('returns a well-formed empty document for a road network declaring no roads', () => {
    expect(liftOpenDriveRoadFacts('<OpenDRIVE></OpenDRIVE>', grounding).trim()).toBe('')
  })

  /**
   * The point of grounding this check in ASAM's ontology is that no namespace
   * in the lifted graph is one this repo made up. A lifted road has no
   * identity beyond the graph it is asserted in, so it is a blank node.
   */
  it('invents no namespace of its own for the lifted roads', () => {
    const ttl = liftOpenDriveRoadFacts(CONTINUOUS_XODR, grounding)
    expect(ttl).not.toMatch(/urn:/)
    expect(ttl).toMatch(/^_:/m)
  })
})
