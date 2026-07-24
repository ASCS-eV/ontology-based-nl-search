/**
 * Plain-JS types the facade exposes to a viewer. These are deliberately free of
 * any Emscripten handles: every value here has already been extracted from the
 * embind boundary and the underlying C++ vector memory freed (see extract.ts).
 * A viewer can hold onto these across frames without leaking WASM heap.
 *
 * Field names are the idiomatic camelCase mirror of the esmini embind structs in
 * `EnvironmentSimulator/Libraries/esminiJS/esminijs.hpp` (@ pinned commit — see
 * versions.json). Distances are metres, angles radians, speed m/s — the units
 * esmini/OpenDRIVE use.
 */

/** A single pose sample along a road/lane polyline (OpenDRIVE s-coordinate). */
export interface RoadPoint {
  /** Distance along the reference line (metres). */
  readonly s: number
  readonly x: number
  readonly y: number
  readonly z: number
  /** Heading (rad). */
  readonly h: number
  /** Pitch (rad). */
  readonly p: number
  /** Roll (rad). */
  readonly r: number
  /** True for the final point of the polyline. */
  readonly endpoint: boolean
}

/** A drivable/other lane surface, bounded by two polylines. */
export interface LaneSurface {
  readonly roadId: number
  readonly laneSectionIndex: number
  readonly laneId: number
  /** OpenDRIVE lane type code. */
  readonly laneType: number
  /** True when this boundary is the outer edge of the road. */
  readonly roadEdge: boolean
  readonly leftBoundary: readonly RoadPoint[]
  readonly rightBoundary: readonly RoadPoint[]
}

/** A road-mark (lane line) polyline with its rendering attributes. */
export interface RoadMark {
  readonly roadId: number
  readonly laneSectionIndex: number
  readonly laneId: number
  readonly type: string
  readonly color: string
  readonly width: number
  readonly lineLength: number
  readonly lineSpace: number
  readonly points: readonly RoadPoint[]
}

/** A lane centre / reference line polyline. */
export interface LaneCenter {
  readonly roadId: number
  readonly laneSectionIndex: number
  readonly laneId: number
  readonly referenceLine: boolean
  readonly centerLane: boolean
  readonly points: readonly RoadPoint[]
}

/** An OpenDRIVE road object outline (e.g. a barrier). */
export interface RoadObject {
  readonly roadId: number
  readonly id: number
  readonly name: string
  readonly type: string
  readonly widthStart: number
  readonly widthEnd: number
  readonly heightStart: number
  readonly heightEnd: number
  readonly points: readonly RoadPoint[]
}

/** A box-shaped road feature (sign/signal placement). */
export interface RoadFeatureBox {
  readonly roadId: number
  readonly id: number
  readonly name: string
  readonly type: string
  readonly kind: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly h: number
  readonly p: number
  readonly r: number
  readonly width: number
  readonly length: number
  readonly height: number
}

/** The static road network geometry, parsed once from the mounted `.xodr`. */
export interface RoadGeometry {
  readonly odrFilename: string
  readonly laneSurfaces: readonly LaneSurface[]
  readonly roadMarks: readonly RoadMark[]
  readonly laneCenters: readonly LaneCenter[]
  readonly roadObjects: readonly RoadObject[]
  readonly roadFeatureBoxes: readonly RoadFeatureBox[]
}

/** The live pose + kinematics of one scenario entity in a frame. */
export interface ObjectState {
  readonly name: string
  readonly id: number
  readonly x: number
  readonly y: number
  readonly z: number
  /** Heading (rad). */
  readonly h: number
  /** Pitch (rad). */
  readonly p: number
  /** Roll (rad). */
  readonly r: number
  readonly roadId: number
  readonly laneId: number
  /** Lateral offset from the lane centre (metres). */
  readonly laneOffset: number
  /** Distance along the road reference line (metres). */
  readonly s: number
  /** Lateral track coordinate (metres). */
  readonly t: number
  readonly speed: number
  readonly width: number
  readonly length: number
  readonly height: number
  readonly objectType: number
  readonly objectCategory: number
}

/** One simulated frame: time plus every entity's pose. */
export interface ScenarioFrame {
  /** Absolute simulation time (seconds). */
  readonly simulationTime: number
  /** The time step that produced this frame (seconds). */
  readonly timeStep: number
  /** esmini step status code. */
  readonly status: number
  /** True once the scenario has reached its natural end (StoryBoard done). */
  readonly quit: boolean
  readonly objects: readonly ObjectState[]
}

/** Timing configuration for stepping the scenario. */
export interface ScenarioConfig {
  /** Safety cap on internal sub-steps per `stepFrame` (esmini default 10000). */
  readonly maxLoop: number
  /** Smallest internal time step (seconds). */
  readonly minTimeStep: number
  /** Largest internal time step (seconds). */
  readonly maxTimeStep: number
  /** Fixed step; 0 lets esmini pick a step within [min, max]. */
  readonly dt: number
}
