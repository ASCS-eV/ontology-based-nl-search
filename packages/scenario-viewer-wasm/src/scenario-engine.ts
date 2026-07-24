/**
 * The viewer-facing facade over an esmini `OpenScenario` instance.
 *
 * Responsibilities:
 *  - own the native handle's lifecycle (`dispose` frees it exactly once; any use
 *    after that throws instead of touching freed WASM memory);
 *  - hand back only plain-JS data (via extract.ts), never embind handles;
 *  - parse the static road geometry exactly once and cache it (it never changes
 *    during a run — re-marshalling it every frame would be wasteful and leaky);
 *  - provide the endless-loop primitive (`advance`) the browser viewer drives.
 */
import type { OpenScenarioHandle, RawOpenScenarioConfig } from './esmini-module.js'
import { extractFrame, extractRoadGeometry } from './extract.js'
import type { RoadGeometry, ScenarioConfig, ScenarioFrame } from './types.js'

/** esmini's `OpenScenarioConfig` defaults (see esminijs.hpp @ pinned commit). */
export const DEFAULT_SCENARIO_CONFIG: ScenarioConfig = {
  maxLoop: 10000,
  minTimeStep: 1 / 120,
  maxTimeStep: 1 / 25,
  dt: 0,
}

/** Build the embind config value_object from a (partial) ScenarioConfig. */
export function toRawConfig(config?: Partial<ScenarioConfig>): RawOpenScenarioConfig {
  const merged = { ...DEFAULT_SCENARIO_CONFIG, ...config }
  return {
    max_loop: merged.maxLoop,
    min_time_step: merged.minTimeStep,
    max_time_step: merged.maxTimeStep,
    dt: merged.dt,
  }
}

/** Raised when a disposed `EsminiScenario` is used again (use-after-free guard). */
export class ScenarioDisposedError extends Error {
  constructor() {
    super('EsminiScenario has been disposed; create a new one to keep playing.')
    this.name = 'ScenarioDisposedError'
  }
}

export class EsminiScenario {
  #handle: OpenScenarioHandle | null
  #roadGeometry: RoadGeometry | null = null

  /**
   * Wrap an already-constructed embind `OpenScenario` handle. Prefer
   * `loadScenario` (load-esmini.ts), which mounts the files and constructs the
   * handle for you; this entry point exists for tests and advanced callers.
   */
  constructor(handle: OpenScenarioHandle) {
    this.#handle = handle
  }

  #live(): OpenScenarioHandle {
    if (this.#handle === null) throw new ScenarioDisposedError()
    return this.#handle
  }

  /** Number of entities in the scenario. */
  objectCount(): number {
    return this.#live().get_object_count()
  }

  /** Current absolute simulation time (seconds). */
  simulationTime(): number {
    return this.#live().get_simulation_time()
  }

  /** True once the scenario reached its natural end. */
  isQuit(): boolean {
    return this.#live().is_quit()
  }

  /**
   * The static road network geometry, parsed once and cached. Safe to call every
   * frame — subsequent calls return the same plain-JS object without touching the
   * WASM boundary.
   */
  roadGeometry(): RoadGeometry {
    if (this.#roadGeometry === null) {
      this.#roadGeometry = extractRoadGeometry(this.#live().get_road_geometry())
    }
    return this.#roadGeometry
  }

  /** Advance one step and return the resulting frame (plain JS, no handles). */
  stepFrame(dt = -1): ScenarioFrame {
    return extractFrame(this.#live().step_frame(dt))
  }

  /** Restart the scenario from time 0. */
  reset(): void {
    this.#live().reset()
  }

  /**
   * Endless-loop primitive: if the scenario has ended, restart it first, then
   * step. Every returned frame is therefore a live, in-progress frame — the
   * viewer can call this on each animation tick to loop forever.
   */
  advance(dt = -1): ScenarioFrame {
    const handle = this.#live()
    if (handle.is_quit()) handle.reset()
    return extractFrame(handle.step_frame(dt))
  }

  /**
   * Free the native ScenarioEngine. Idempotent: calling it again is a no-op.
   * After disposal every other method throws `ScenarioDisposedError`.
   */
  dispose(): void {
    if (this.#handle === null) return
    this.#handle.delete()
    this.#handle = null
    this.#roadGeometry = null
  }
}
