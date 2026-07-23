/**
 * Loader for the in-process OpenSCENARIO WASM engine.
 *
 * Mirrors `WorkerOxigraphStore` in packages/sparql: the engine is a single WASM
 * module loaded once and called in-process. It is a pure, deterministic function
 * — only already-structured data (a `.xosc` string) crosses the boundary, never
 * LLM free-text — so there is no cold-start, port, or auth surface.
 */
import createOscEngine, { type OscEngineModule } from '../wasm/osc-engine.mjs'
import type {
  Diagnostic,
  EngineFiles,
  EngineInfo,
  EngineTree,
  OscEngine,
  Severity,
  ValidationResult,
} from './types.js'

/** Raw JSON shape returned by the embind `validate`. */
interface RawValidateResult {
  ok?: boolean
  errorCount?: number
  messageCount?: number
  fatal?: string
  messages?: ReadonlyArray<{ level: number; line: number; col: number; msg: string }>
}

/**
 * The engine's `ErrorLevel` enum: DEBUG=0, INFO=1, WARNING=2, ERROR=3, FATAL=4.
 * Anything >= ERROR fails validation.
 */
function toSeverity(level: number): Severity {
  if (level >= 3) return 'error'
  if (level === 2) return 'warning'
  return 'info'
}

/**
 * Extract the human message from the engine's `ToString()` format
 * `Message: '<msg>' ErrorLevel: <lvl> Textmarker: '<path>(l,c)'`, so we neither
 * leak the internal MEMFS path nor surface the verbose wrapper. Falls back to
 * the raw string when the format does not match.
 */
function cleanMessage(raw: string): string {
  const m = /Message:\s*'([\s\S]*)'\s*ErrorLevel:/.exec(raw)
  return m?.[1] ?? raw
}

let idCounter = 0

/** Turn the parsed IR/module surface into the public typed engine. */
function wrap(mod: OscEngineModule): OscEngine {
  return {
    describe(): EngineInfo {
      return JSON.parse(mod.describe()) as EngineInfo
    },

    validate(xosc: string, files?: EngineFiles): ValidationResult {
      const dir = `/work/${idCounter++}`
      const written: string[] = []
      mod.FS.mkdirTree(dir)
      const mainPath = `${dir}/scenario.xosc`
      mod.FS.writeFile(mainPath, xosc)
      written.push(mainPath)
      for (const [rel, content] of Object.entries(files ?? {})) {
        const full = `${dir}/${rel}`
        const slash = full.lastIndexOf('/')
        if (slash > 0) mod.FS.mkdirTree(full.slice(0, slash))
        mod.FS.writeFile(full, content)
        written.push(full)
      }

      let raw: RawValidateResult
      try {
        raw = JSON.parse(mod.validate(mainPath)) as RawValidateResult
      } finally {
        for (const p of written) {
          try {
            mod.FS.unlink(p)
          } catch {
            // best-effort MEMFS cleanup
          }
        }
      }

      if (typeof raw.fatal === 'string') {
        return {
          ok: false,
          diagnostics: [{ severity: 'error', line: 0, col: 0, message: raw.fatal }],
        }
      }
      const diagnostics: Diagnostic[] = (raw.messages ?? []).map((m) => ({
        severity: toSeverity(m.level),
        line: m.line,
        col: m.col,
        message: cleanMessage(m.msg),
      }))
      return { ok: raw.ok === true, diagnostics }
    },

    author(tree: EngineTree): string {
      // The facade returns the emitted .xosc, or a JSON `{"fatal":…}` object on
      // an authoring fault (a valid document always begins with `<?xml`).
      const out = mod.author(JSON.stringify(tree))
      if (out.startsWith('{')) {
        const parsed = JSON.parse(out) as { fatal?: string }
        throw new Error(`authoring failed: ${parsed.fatal ?? 'unknown error'}`)
      }
      return out
    },
  }
}

/**
 * Instantiate the OpenSCENARIO engine. Resolves once the WASM binary is
 * compiled and instantiated (tens of ms). The returned engine is reusable and
 * stateless across calls.
 */
export async function loadOscEngine(): Promise<OscEngine> {
  const mod = await createOscEngine()
  return wrap(mod)
}
