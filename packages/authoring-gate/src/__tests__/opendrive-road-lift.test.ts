import { describe, expect, it } from 'vitest'

import { resolveOpenDriveRoadGrounding } from '../opendrive-ontology.js'
import { liftOpenDriveRoadFacts } from '../opendrive-road-lift.js'
import { CONTINUOUS_XODR, NO_ROAD_ONE_XODR } from './fixtures/xodr.js'

describe('liftOpenDriveRoadFacts', () => {
  it('emits a fact for the top-level road, typed and keyed by the REAL ASAM ontology IRIs', () => {
    const { roadClassIri, roadIdPropertyIri } = resolveOpenDriveRoadGrounding()
    const ttl = liftOpenDriveRoadFacts(CONTINUOUS_XODR)
    expect(ttl).toContain(`a <${roadClassIri}>`)
    expect(ttl).toContain(`<${roadIdPropertyIri}> "1"`)
  })

  it('emits the id declared by a differently-numbered road network', () => {
    const { roadIdPropertyIri } = resolveOpenDriveRoadGrounding()
    const ttl = liftOpenDriveRoadFacts(NO_ROAD_ONE_XODR)
    expect(ttl).toContain(`<${roadIdPropertyIri}> "5"`)
    expect(ttl).not.toContain(`<${roadIdPropertyIri}> "1"`)
  })

  it('returns a well-formed empty document (no throw) for malformed XML', () => {
    expect(() => liftOpenDriveRoadFacts('<not-xml')).not.toThrow()
  })

  it('returns a well-formed empty document for a road network declaring no roads', () => {
    const ttl = liftOpenDriveRoadFacts('<OpenDRIVE></OpenDRIVE>')
    expect(ttl.trim()).toBe('')
  })
})
