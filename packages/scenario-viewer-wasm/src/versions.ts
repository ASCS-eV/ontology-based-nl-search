/**
 * Single source of truth for the upstream esmini pin and toolchain this WASM
 * artifact was produced from. `versions.json` (package root) is the one
 * human-edited pin; `native/BUILD.md` documents the reproducible recipe and
 * `wasm/esmini.js.sha256` is the integrity manifest for the committed blob.
 */
import versions from '../versions.json' with { type: 'json' }

export interface ViewerEngineVersions {
  /** Upstream project name. */
  readonly engine: string
  /** Canonical upstream repository URL. */
  readonly engineRepo: string
  /** Full upstream commit SHA the WASM was built from (the real pin). */
  readonly engineCommit: string
  /** Upstream branch the pin lives on. */
  readonly engineBranch: string
  /** In-repo path of the esminiJS Emscripten target. */
  readonly esminiJsPath: string
  /** Pinned Emscripten SDK version the WASM was compiled with. */
  readonly emscripten: string
  /** True when the build inlines the `.wasm` into `esmini.js` (SINGLE_FILE). */
  readonly singleFile: boolean
}

/** The versions the committed `wasm/esmini.js` artifact was built from. */
export const VIEWER_ENGINE_VERSIONS: ViewerEngineVersions = versions
