/**
 * Types for the curated OpenDRIVE road catalog.
 *
 * A {@link CatalogRoad} pairs the referenced `.xodr` **bytes** (the single source
 * every consumer mounts — the authoring gates, the qc self-test, and the browser
 * viewer) with its **discovered** topology. The topology is parsed from the road
 * itself at build time (native/generate.mjs), never hand-authored, so lane ids and
 * lengths cannot drift from the geometry the simulator actually loads.
 *
 * [OpenDRIVE] ASAM OpenDRIVE — `road/@rule`, `lane/@id`, `lane/@type`, and the
 * road `link/successor` element carry the fields discovered here.
 */

/** Travel-side rule of a road network (OpenDRIVE `road/@rule`). */
export type TrafficRule = 'RHT' | 'LHT'

/** Side of the reference line a lane sits on (sign of its id; 0 is the reference lane). */
export type LaneSide = 'left' | 'right'

/** One drivable lane discovered in a road's first lane section. */
export interface DrivableLane {
  /** Id of the road the lane belongs to. */
  readonly roadId: string
  /** Signed OpenDRIVE lane id, e.g. `-3`. */
  readonly laneId: string
  /** OpenDRIVE lane type — always `driving` for a catalog drivable lane. */
  readonly type: string
  /** Which side of the reference line (positive id ⇒ left, negative ⇒ right). */
  readonly side: LaneSide
}

/** One `<road>` element of the network. */
export interface RoadSegment {
  /** OpenDRIVE road id. */
  readonly id: string
  /** Road length in metres (`road/@length`). */
  readonly length: number
  /** The id of the road this one continues into, when its successor is a road. */
  readonly successorRoadId?: string
  /** Drivable lanes in the road's first lane section, ordered as authored. */
  readonly drivableLanes: readonly DrivableLane[]
}

/** The topology of a road network, discovered from the `.xodr` at build time. */
export interface RoadTopology {
  /** Travel-side rule shared by the network's roads. */
  readonly rule: TrafficRule
  /** Every road element, in document order. */
  readonly roads: readonly RoadSegment[]
  /**
   * The entry road: the road that is no other road's successor (the head of the
   * chain). Entities are placed here by default. Falls back to the first road.
   */
  readonly entryRoadId: string
}

/** License + provenance of a vendored road (the submodule it was generated from). */
export interface RoadProvenance {
  /** SPDX license identifier of the source repository. */
  readonly spdx: string
  /** Source repository URL. */
  readonly source: string
  /** Pinned commit the bytes were generated from. */
  readonly commit: string
  /** Human-readable attribution line. */
  readonly attribution: string
}

/**
 * A catalog road: the `.xodr` bytes a `.xosc` `<LogicFile filepath=…>` references,
 * plus the discovered topology and provenance.
 */
export interface CatalogRoad {
  /** Stable catalog id. */
  readonly id: string
  /** The `.xodr` filename a scenario's `<LogicFile>` names — the catalog key. */
  readonly logicFile: string
  /** Short human description. */
  readonly description: string
  /** The full `.xodr` content — the single source of bytes for every consumer. */
  readonly xodr: string
  /** Topology discovered from {@link CatalogRoad.xodr}. */
  readonly topology: RoadTopology
  /** License + provenance of the bytes. */
  readonly provenance: RoadProvenance
}
