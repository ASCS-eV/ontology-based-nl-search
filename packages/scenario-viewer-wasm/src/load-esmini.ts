/**
 * Browser-only glue: instantiate the compiled `esmini.js` module, mount the
 * scenario + its companion road file into the Emscripten in-memory filesystem,
 * and hand back a leak-free {@link EsminiScenario}.
 *
 * This is the one module that actually depends on a running Emscripten runtime,
 * so it cannot execute under Node and is verified by the apps/web island's
 * Playwright e2e in a real browser (see vitest coverage exclusions). All the
 * memory-safety logic it relies on lives in extract.ts / scenario-engine.ts and
 * IS unit-tested here against a faithful mock module.
 */
import type { EmscriptenFS, EsminiFactory } from './esmini-module.js'
import { EsminiScenario, toRawConfig } from './scenario-engine.js'
import type { ScenarioConfig } from './types.js'

export interface LoadScenarioOptions {
  /** The `.xosc` document text. */
  readonly xosc: string
  /**
   * Companion files to mount alongside the scenario, keyed by the exact name the
   * `.xosc` references — typically its RoadNetwork LogicFile basename mapped to
   * the `.xodr` text. Keying by the referenced name is what keeps "what you
   * validate" and "what you see" the same bytes.
   */
  readonly files?: Readonly<Record<string, string | Uint8Array>>
  /** Timing overrides; defaults to DEFAULT_SCENARIO_CONFIG. */
  readonly config?: Partial<ScenarioConfig>
  /** Absolute mount path for the scenario; defaults to `/scenario.xosc`. */
  readonly scenarioPath?: string
}

/** Ensure a leading slash so paths mount at the MEMFS root. */
function absolutize(name: string): string {
  return name.startsWith('/') ? name : `/${name}`
}

/** `mkdir -p` for the parent directory of `path`, tolerating existing dirs. */
function ensureParentDirs(fs: EmscriptenFS, path: string): void {
  const segments = path.split('/').filter(Boolean)
  segments.pop() // drop the filename
  let dir = ''
  for (const segment of segments) {
    dir += `/${segment}`
    try {
      fs.mkdir(dir)
    } catch {
      // Directory already exists — Emscripten throws ErrnoError(EEXIST); ignore.
    }
  }
}

function writeFile(fs: EmscriptenFS, path: string, content: string | Uint8Array): void {
  ensureParentDirs(fs, path)
  fs.writeFile(path, content)
}

/**
 * Load a scenario for playback. Resolves once esmini has parsed the `.xosc` and
 * its road; step it via the returned {@link EsminiScenario}.
 */
export async function loadScenario(
  factory: EsminiFactory,
  options: LoadScenarioOptions
): Promise<EsminiScenario> {
  const module = await factory()
  const scenarioPath = options.scenarioPath ?? '/scenario.xosc'

  writeFile(module.FS, scenarioPath, options.xosc)
  for (const [name, content] of Object.entries(options.files ?? {})) {
    writeFile(module.FS, absolutize(name), content)
  }

  const handle = new module.OpenScenario(scenarioPath, toRawConfig(options.config))
  return new EsminiScenario(handle)
}
