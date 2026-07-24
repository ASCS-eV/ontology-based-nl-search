/**
 * A faithful mock of the esmini embind boundary for off-browser unit tests.
 *
 * The whole point of the facade is memory safety, so the mock's job is to make
 * leaks *observable*: every vector handle registers itself and flips a `deleted`
 * flag when freed, and the OpenScenario handle records its own `delete()`. Tests
 * then assert the registry is fully drained after each operation.
 */
import type {
  EmVector,
  OpenScenarioHandle,
  RawRoadGeometryPoint,
  RawScenarioFrame,
  RawScenarioObjectState,
  RawScenarioRoadGeometry,
} from '../esmini-module.js'

/** Tracks every vector handle created so tests can assert none leaked. */
export class HandleRegistry {
  readonly vectors: TrackedVector<unknown>[] = []

  makeVector<T>(items: readonly T[]): TrackedVector<T> {
    const vec = new TrackedVector<T>(items)
    this.vectors.push(vec as TrackedVector<unknown>)
    return vec
  }

  /** Number of vector handles still holding heap memory. */
  liveCount(): number {
    return this.vectors.filter((v) => !v.deleted).length
  }

  /** How many times `.get(i)` was served across all handles (marshalling cost). */
  totalGets(): number {
    return this.vectors.reduce((sum, v) => sum + v.getCount, 0)
  }
}

export class TrackedVector<T> implements EmVector<T> {
  deleted = false
  getCount = 0
  deleteCount = 0
  readonly #items: readonly T[]

  constructor(items: readonly T[]) {
    this.#items = items
  }

  size(): number {
    return this.#items.length
  }

  get(index: number): T {
    if (this.deleted) throw new Error('use-after-free: get() on a deleted vector')
    this.getCount += 1
    const item = this.#items[index]
    if (item === undefined) throw new Error(`mock vector index out of range: ${index}`)
    return item
  }

  delete(): void {
    this.deleted = true
    this.deleteCount += 1
  }
}

export function point(overrides: Partial<RawRoadGeometryPoint> = {}): RawRoadGeometryPoint {
  return { s: 0, x: 0, y: 0, z: 0, h: 0, p: 0, r: 0, endpoint: false, ...overrides }
}

export function objectState(
  overrides: Partial<RawScenarioObjectState> = {}
): RawScenarioObjectState {
  return {
    name: 'Ego',
    id: 0,
    x: 1,
    y: 2,
    z: 0,
    h: 0.5,
    p: 0,
    r: 0,
    road_id: 37,
    lane_id: -3,
    lane_offset: 0,
    s: 500,
    t: -6,
    speed: 27.78,
    width: 2,
    length: 5,
    height: 1.5,
    object_type: 1,
    object_category: 1,
    ...overrides,
  }
}

/** Build a raw frame whose `object_states` handle is registered for leak checks. */
export function rawFrame(
  registry: HandleRegistry,
  states: readonly RawScenarioObjectState[],
  overrides: Partial<Omit<RawScenarioFrame, 'object_states'>> = {}
): RawScenarioFrame {
  return {
    simulation_time: 1.5,
    time_step: 0.05,
    status: 0,
    quit: false,
    object_states: registry.makeVector(states),
    ...overrides,
  }
}

/**
 * Build a raw road geometry with a realistic nested-handle tree: two lane
 * surfaces (each with left+right boundary handles), one road mark, one lane
 * centre, one road object (each with a points handle) and one flat feature box —
 * so the extractor's recursive freeing is fully exercised.
 */
export function rawRoadGeometry(registry: HandleRegistry): RawScenarioRoadGeometry {
  const laneSurface = (laneId: number) => ({
    road_id: 37,
    lane_section_index: 0,
    lane_id: laneId,
    lane_type: 2,
    road_edge: laneId === -4,
    left_boundary: registry.makeVector([point({ s: 0 }), point({ s: 10, endpoint: true })]),
    right_boundary: registry.makeVector([point({ s: 0 }), point({ s: 10 })]),
  })
  return {
    odr_filename: 'german_highway_short.xodr',
    lane_surfaces: registry.makeVector([laneSurface(-3), laneSurface(-4)]),
    road_marks: registry.makeVector([
      {
        road_id: 37,
        lane_section_index: 0,
        lane_id: -3,
        type: 'broken',
        color: 'white',
        width: 0.12,
        line_length: 3,
        line_space: 6,
        points: registry.makeVector([point(), point({ s: 3, endpoint: true })]),
      },
    ]),
    lane_centers: registry.makeVector([
      {
        road_id: 37,
        lane_section_index: 0,
        lane_id: -3,
        reference_line: false,
        center_lane: true,
        points: registry.makeVector([point(), point({ s: 5 })]),
      },
    ]),
    road_objects: registry.makeVector([
      {
        road_id: 37,
        id: 1,
        name: 'barrier',
        type: 'barrier',
        width_start: 0.3,
        width_end: 0.3,
        height_start: 0.8,
        height_end: 0.8,
        points: registry.makeVector([point(), point({ s: 20, endpoint: true })]),
      },
    ]),
    road_feature_boxes: registry.makeVector([
      {
        road_id: 37,
        id: 2,
        name: 'sign',
        type: 'sign',
        kind: 'speed',
        x: 3,
        y: 4,
        z: 2,
        h: 0,
        p: 0,
        r: 0,
        width: 0.5,
        length: 0.1,
        height: 0.7,
      },
    ]),
  }
}

export interface MockHandleOptions {
  readonly registry: HandleRegistry
  readonly objectCount?: number
  /** Sequence of `is_quit` return values, consumed left-to-right (last repeats). */
  readonly quitSequence?: readonly boolean[]
  readonly states?: readonly RawScenarioObjectState[]
}

/** A spy-able OpenScenario handle backed by the registry. */
export class MockHandle implements OpenScenarioHandle {
  deleted = false
  stepCount = 0
  resetCount = 0
  roadGeometryCount = 0
  #quitCalls = 0
  readonly #opts: MockHandleOptions

  constructor(opts: MockHandleOptions) {
    this.#opts = opts
  }

  step_frame(): RawScenarioFrame {
    if (this.deleted) throw new Error('use-after-free: step_frame on deleted handle')
    this.stepCount += 1
    return rawFrame(this.#opts.registry, this.#opts.states ?? [objectState()])
  }

  reset(): void {
    if (this.deleted) throw new Error('use-after-free: reset on deleted handle')
    this.resetCount += 1
  }

  get_road_geometry(): RawScenarioRoadGeometry {
    if (this.deleted) throw new Error('use-after-free: get_road_geometry on deleted handle')
    this.roadGeometryCount += 1
    return rawRoadGeometry(this.#opts.registry)
  }

  get_object_count(): number {
    return this.#opts.objectCount ?? 1
  }

  get_simulation_time(): number {
    return this.stepCount * 0.05
  }

  is_quit(): boolean {
    const seq = this.#opts.quitSequence ?? [false]
    const value = seq[Math.min(this.#quitCalls, seq.length - 1)] ?? false
    this.#quitCalls += 1
    return value
  }

  delete(): void {
    this.deleted = true
  }
}
