/**
 * TypeScript shapes for the raw esmini embind boundary — the surface the
 * compiled `wasm/esmini.js` exposes. These mirror `embind.cpp` /
 * `esminijs.hpp` at the pinned commit (see versions.json) exactly.
 *
 * The critical distinction encoded here is memory ownership:
 *
 *  - `value_object` results (frames, object states, geometry structs) cross the
 *    boundary BY VALUE as plain JS objects — no cleanup needed for the object
 *    itself.
 *  - every `std::vector<T>` field registered via `register_vector` crosses as an
 *    `EmVector<T>` HANDLE that owns a heap-allocated copy. Each such handle MUST
 *    be `.delete()`d or the WASM heap leaks — fatal for a 20 Hz endless-loop
 *    viewer. `extract.ts` is the single place that drains and frees them.
 *
 * Field names stay snake_case here to match the C++ `.field(...)` names; the
 * plain-JS mirror in `types.ts` is camelCase.
 */

/** A handle to an embind `std::vector<T>`. Owns WASM heap memory. */
export interface EmVector<T> {
  size(): number
  get(index: number): T
  /** Frees the underlying C++ vector. Mandatory — see module docstring. */
  delete(): void
}

export interface RawRoadGeometryPoint {
  readonly s: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly h: number
  readonly p: number
  readonly r: number
  readonly endpoint: boolean
}

export interface RawLaneSurfaceGeometry {
  readonly road_id: number
  readonly lane_section_index: number
  readonly lane_id: number
  readonly lane_type: number
  readonly road_edge: boolean
  readonly left_boundary: EmVector<RawRoadGeometryPoint>
  readonly right_boundary: EmVector<RawRoadGeometryPoint>
}

export interface RawRoadMarkGeometry {
  readonly road_id: number
  readonly lane_section_index: number
  readonly lane_id: number
  readonly type: string
  readonly color: string
  readonly width: number
  readonly line_length: number
  readonly line_space: number
  readonly points: EmVector<RawRoadGeometryPoint>
}

export interface RawLaneCenterGeometry {
  readonly road_id: number
  readonly lane_section_index: number
  readonly lane_id: number
  readonly reference_line: boolean
  readonly center_lane: boolean
  readonly points: EmVector<RawRoadGeometryPoint>
}

export interface RawRoadObjectGeometry {
  readonly road_id: number
  readonly id: number
  readonly name: string
  readonly type: string
  readonly width_start: number
  readonly width_end: number
  readonly height_start: number
  readonly height_end: number
  readonly points: EmVector<RawRoadGeometryPoint>
}

export interface RawRoadFeatureBoxGeometry {
  readonly road_id: number
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

export interface RawScenarioRoadGeometry {
  readonly odr_filename: string
  readonly lane_surfaces: EmVector<RawLaneSurfaceGeometry>
  readonly road_marks: EmVector<RawRoadMarkGeometry>
  readonly lane_centers: EmVector<RawLaneCenterGeometry>
  readonly road_objects: EmVector<RawRoadObjectGeometry>
  readonly road_feature_boxes: EmVector<RawRoadFeatureBoxGeometry>
}

export interface RawScenarioObjectState {
  readonly name: string
  readonly id: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly h: number
  readonly p: number
  readonly r: number
  readonly road_id: number
  readonly lane_id: number
  readonly lane_offset: number
  readonly s: number
  readonly t: number
  readonly speed: number
  readonly width: number
  readonly length: number
  readonly height: number
  readonly object_type: number
  readonly object_category: number
}

export interface RawScenarioFrame {
  readonly simulation_time: number
  readonly time_step: number
  readonly status: number
  readonly quit: boolean
  readonly object_states: EmVector<RawScenarioObjectState>
}

/** The embind config `value_object` passed to the `OpenScenario` constructor. */
export interface RawOpenScenarioConfig {
  max_loop: number
  min_time_step: number
  max_time_step: number
  dt: number
}

/**
 * The embind `OpenScenario` class instance — a `class_` handle. It owns a native
 * ScenarioEngine and MUST be `.delete()`d when the viewer tears down.
 */
export interface OpenScenarioHandle {
  step_frame(dt: number): RawScenarioFrame
  reset(): void
  get_road_geometry(): RawScenarioRoadGeometry
  get_object_count(): number
  get_simulation_time(): number
  is_quit(): boolean
  /** Frees the native ScenarioEngine. Mandatory on teardown. */
  delete(): void
}

/** Minimal Emscripten in-memory filesystem surface used by the loader. */
export interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array): void
  mkdir(path: string): void
  unlink(path: string): void
}

/**
 * The instantiated Emscripten module `wasm/esmini.js` resolves to. Only the
 * members the facade needs are typed.
 */
export interface EsminiModule {
  readonly OpenScenario: new (xoscPath: string, config: RawOpenScenarioConfig) => OpenScenarioHandle
  readonly FS: EmscriptenFS
}

/**
 * The Emscripten `MODULARIZE` factory the built `esmini.js` exports as the global
 * `esmini`. Calling it (optionally with overrides) resolves the module. In the
 * browser the app imports `esmini.js` and passes this in; the facade never binds
 * the artifact itself, which keeps the facade testable off-browser.
 */
export type EsminiFactory = (overrides?: Record<string, unknown>) => Promise<EsminiModule>
