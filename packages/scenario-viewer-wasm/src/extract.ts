/**
 * The single place that crosses the esmini embind boundary and frees its heap.
 *
 * Every `EmVector<T>` handle returned by the module owns a heap-allocated C++
 * vector. If it is not `.delete()`d it leaks WASM memory; at a 20 Hz endless
 * loop that is an unbounded leak. `drainVector` is therefore the ONLY way this
 * package reads a vector: it copies the elements out to plain JS and frees the
 * handle in a `finally`, so the handle is released even if mapping throws.
 *
 * Nested vectors (a geometry element's `points`/boundaries) are drained by the
 * element mapper *before* the outer handle is freed, so the whole tree is
 * converted to plain JS with no surviving handles.
 */
import type {
  EmVector,
  RawLaneCenterGeometry,
  RawLaneSurfaceGeometry,
  RawRoadFeatureBoxGeometry,
  RawRoadGeometryPoint,
  RawRoadMarkGeometry,
  RawRoadObjectGeometry,
  RawScenarioFrame,
  RawScenarioObjectState,
  RawScenarioRoadGeometry,
} from './esmini-module.js'
import type {
  LaneCenter,
  LaneSurface,
  ObjectState,
  RoadFeatureBox,
  RoadGeometry,
  RoadMark,
  RoadObject,
  RoadPoint,
  ScenarioFrame,
} from './types.js'

/**
 * Copy every element of an embind vector out via `map`, then free the handle.
 * The `finally` guarantees the underlying C++ vector is released even if `map`
 * (which may itself drain nested handles) throws.
 */
export function drainVector<T, R>(vec: EmVector<T>, map: (item: T) => R): R[] {
  try {
    const out: R[] = []
    const n = vec.size()
    for (let i = 0; i < n; i += 1) {
      out.push(map(vec.get(i)))
    }
    return out
  } finally {
    vec.delete()
  }
}

function toPoint(p: RawRoadGeometryPoint): RoadPoint {
  return { s: p.s, x: p.x, y: p.y, z: p.z, h: p.h, p: p.p, r: p.r, endpoint: p.endpoint }
}

function toObjectState(o: RawScenarioObjectState): ObjectState {
  return {
    name: o.name,
    id: o.id,
    x: o.x,
    y: o.y,
    z: o.z,
    h: o.h,
    p: o.p,
    r: o.r,
    roadId: o.road_id,
    laneId: o.lane_id,
    laneOffset: o.lane_offset,
    s: o.s,
    t: o.t,
    speed: o.speed,
    width: o.width,
    length: o.length,
    height: o.height,
    objectType: o.object_type,
    objectCategory: o.object_category,
  }
}

function toLaneSurface(s: RawLaneSurfaceGeometry): LaneSurface {
  return {
    roadId: s.road_id,
    laneSectionIndex: s.lane_section_index,
    laneId: s.lane_id,
    laneType: s.lane_type,
    roadEdge: s.road_edge,
    leftBoundary: drainVector(s.left_boundary, toPoint),
    rightBoundary: drainVector(s.right_boundary, toPoint),
  }
}

function toRoadMark(m: RawRoadMarkGeometry): RoadMark {
  return {
    roadId: m.road_id,
    laneSectionIndex: m.lane_section_index,
    laneId: m.lane_id,
    type: m.type,
    color: m.color,
    width: m.width,
    lineLength: m.line_length,
    lineSpace: m.line_space,
    points: drainVector(m.points, toPoint),
  }
}

function toLaneCenter(c: RawLaneCenterGeometry): LaneCenter {
  return {
    roadId: c.road_id,
    laneSectionIndex: c.lane_section_index,
    laneId: c.lane_id,
    referenceLine: c.reference_line,
    centerLane: c.center_lane,
    points: drainVector(c.points, toPoint),
  }
}

function toRoadObject(o: RawRoadObjectGeometry): RoadObject {
  return {
    roadId: o.road_id,
    id: o.id,
    name: o.name,
    type: o.type,
    widthStart: o.width_start,
    widthEnd: o.width_end,
    heightStart: o.height_start,
    heightEnd: o.height_end,
    points: drainVector(o.points, toPoint),
  }
}

function toRoadFeatureBox(b: RawRoadFeatureBoxGeometry): RoadFeatureBox {
  return {
    roadId: b.road_id,
    id: b.id,
    name: b.name,
    type: b.type,
    kind: b.kind,
    x: b.x,
    y: b.y,
    z: b.z,
    h: b.h,
    p: b.p,
    r: b.r,
    width: b.width,
    length: b.length,
    height: b.height,
  }
}

/** Extract a frame to plain JS, freeing its `object_states` handle. */
export function extractFrame(raw: RawScenarioFrame): ScenarioFrame {
  return {
    simulationTime: raw.simulation_time,
    timeStep: raw.time_step,
    status: raw.status,
    quit: raw.quit,
    objects: drainVector(raw.object_states, toObjectState),
  }
}

/**
 * Extract the whole road geometry to plain JS, freeing all five top-level
 * vector handles and every nested polyline handle underneath them.
 */
export function extractRoadGeometry(raw: RawScenarioRoadGeometry): RoadGeometry {
  return {
    odrFilename: raw.odr_filename,
    laneSurfaces: drainVector(raw.lane_surfaces, toLaneSurface),
    roadMarks: drainVector(raw.road_marks, toRoadMark),
    laneCenters: drainVector(raw.lane_centers, toLaneCenter),
    roadObjects: drainVector(raw.road_objects, toRoadObject),
    roadFeatureBoxes: drainVector(raw.road_feature_boxes, toRoadFeatureBox),
  }
}
