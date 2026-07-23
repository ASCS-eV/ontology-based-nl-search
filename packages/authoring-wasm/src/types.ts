/**
 * Public types for the in-process OpenSCENARIO WASM engine.
 *
 * The engine is the RA Consulting `openscenario.api.test` C++ API (Apache-2.0)
 * compiled to WebAssembly. Everything crosses the WASM boundary as strings +
 * plain data — no native handles leak into TypeScript.
 *
 * [OSC-XSD] OpenSCENARIO 1.3 — the checker rules the engine runs are generated
 * from the ASAM UML model (range/cardinality/union/enum + parameter resolution).
 */

/** Capability descriptor returned by {@link OscEngine.describe}. */
export interface EngineInfo {
  /** Engine implementation identifier. */
  readonly engine: string
  /** Pinned RAC submodule commit the binary was built from. */
  readonly engineCommit: string
  /** OpenSCENARIO versions this build supports. */
  readonly oscVersions: readonly string[]
  /** OpenSCENARIO XSD version the checker targets. */
  readonly xsd: string
}

/** Diagnostic severity, normalized from the engine's `ErrorLevel` enum. */
export type Severity = 'error' | 'warning' | 'info'

/** A single validation diagnostic with source location. */
export interface Diagnostic {
  readonly severity: Severity
  /** 1-based source line, or 0 when the engine reports no marker. */
  readonly line: number
  /** 1-based source column, or 0 when the engine reports no marker. */
  readonly col: number
  /** Human-readable message from the checker rule. */
  readonly message: string
}

/** Result of {@link OscEngine.validate}. `ok` is false iff any error/fatal. */
export interface ValidationResult {
  readonly ok: boolean
  readonly diagnostics: readonly Diagnostic[]
}

/**
 * Extra files to place on the engine's in-memory filesystem before validation,
 * keyed by the path the scenario references them at (e.g. catalog imports).
 * Paths are resolved relative to the scenario's directory, exactly as a real
 * OpenSCENARIO tool resolves catalog/import references.
 */
export type EngineFiles = Readonly<Record<string, string>>

/**
 * The in-process OpenSCENARIO engine. Load once via {@link loadOscEngine}, then
 * call in-process — mirroring `WorkerOxigraphStore` in packages/sparql.
 */
export interface OscEngine {
  /** Report engine / OSC / XSD versions (a capability probe). */
  describe(): EngineInfo
  /**
   * Validate a scenario. `xosc` is the main document; `files` supplies any
   * referenced catalogs/imports by their referenced path.
   */
  validate(xosc: string, files?: EngineFiles): ValidationResult
}
