/**
 * Single source of truth for the engine / OpenSCENARIO / XSD / toolchain
 * versions this WASM build was produced from.
 *
 * `versions.json` (package root) is the ONE human-edited pin. It also feeds the
 * C++ `describe()` payload at build time (native/build.mjs generates
 * `osc_versions_generated.h` from it), so the compiled WASM pin and this TS pin
 * cannot drift — the drift test in `src/__tests__/engine.test.ts` asserts the
 * two are byte-identical, and the capability probe in packages/authoring
 * derives its expected build from `ENGINE_VERSIONS`.
 */
import versions from '../versions.json' with { type: 'json' }

export interface EngineVersions {
  /** Engine name, e.g. "RAC openscenario.api.test". */
  readonly engine: string
  /** Full upstream commit SHA the WASM was built from (the real pin). */
  readonly engineCommit: string
  /** `git describe` of that commit, e.g. "v1.4.1-2-g292d0be8". */
  readonly engineTag: string
  /** Supported OpenSCENARIO minor versions, e.g. ["1.3"]. */
  readonly oscVersions: readonly string[]
  /** ASAM OpenSCENARIO XSD version used as the wire cross-check. */
  readonly xsd: string
  /** Pinned Emscripten SDK version the WASM was compiled with. */
  readonly emscripten: string
}

/** The versions the committed `osc-engine.wasm` artifact was built from. */
export const ENGINE_VERSIONS: EngineVersions = versions
