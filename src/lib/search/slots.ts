/**
 * Search slot types — the structured intermediate representation.
 * The LLM fills these; code compiles them to SPARQL.
 */
export interface SearchSlots {
  country?: string // ISO 2-letter
  state?: string // e.g. "DE-BY"
  region?: string
  city?: string
  roadType?: string // motorway, town, rural, intersection, roundabout
  laneType?: string // driving, shoulder, parking, walking, biking, bus
  levelOfDetail?: string // full, crosswalk, signal, lane-marking, basic
  trafficDirection?: string // right-hand, left-hand
  formatType?: string // "ASAM OpenDRIVE", "Lanelet2", "NDS.Live", etc.
  formatVersion?: string // "1.4", "1.6", "1.7", "1.8"
  dataSource?: string // lidar, scanner, camera, satellite, survey, aerial
  license?: string // CC-BY-4.0, MIT, etc.
  minLength?: number // km
  maxLength?: number // km
  minIntersections?: number
  minTrafficLights?: number
  minTrafficSigns?: number
  maxSpeedLimit?: number // km/h
  minSpeedLimit?: number // km/h
}
