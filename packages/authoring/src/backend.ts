/**
 * The authoring backend seam — mirrors `SparqlStore` in packages/sparql.
 *
 * The whole codebase depends only on this `AuthoringBackend` interface; the
 * concrete engine (the in-process OpenSCENARIO WASM module, task 08) is one
 * config-selected implementation, exactly as Oxigraph is one `SparqlStore`.
 *
 * This increment exposes `describe` + `validate` (the runtime structural /
 * semantic gate). IR → `.xosc` emission (`lower`) is added to this interface by
 * task 04, together with the model-driven writer facade it needs.
 *
 * [OSC-XSD] OpenSCENARIO 1.3 — validation is delegated to the engine, whose
 * checker rules are generated from the ASAM UML model.
 */
import type { Diagnostic, EngineFiles, EngineInfo, Severity } from '@ontology-search/authoring-wasm'

export type { EngineFiles, EngineInfo, Severity }

/**
 * A validation diagnostic surfaced by the backend. Extends the engine's
 * {@link Diagnostic} with an optional ASAM Quality-Checker rule UID
 * (`asam.net:xosc:…`) so the semantic gate (task 03) and the repair loop
 * (task 05) can attribute a violation to the same rule identity they emit —
 * shape-compatible with `OntologyGap`.
 *
 * `ruleUid` is populated only where the engine surfaces a structured rule
 * identity. The RAC checker emits free-text messages today, so it is absent
 * until the engine (task 08) exposes rule ids — it is never fabricated.
 */
export interface AuthoringDiagnostic extends Diagnostic {
  readonly ruleUid?: string
}

/** Result of {@link AuthoringBackend.validate}. `ok` is false iff any error. */
export interface AuthoringValidationResult {
  readonly ok: boolean
  readonly diagnostics: readonly AuthoringDiagnostic[]
}

/** Per-call options for {@link AuthoringBackend.validate}. */
export interface AuthoringValidateOptions {
  /**
   * Cooperative cancellation for a disconnected client (SSE close, request
   * abort). The WASM call is synchronous and cannot be interrupted mid-flight,
   * so the signal is honoured at the call boundary (before dispatch).
   */
  readonly signal?: AbortSignal
  /** Companion files (catalogs/imports) staged next to the scenario document. */
  readonly files?: EngineFiles
}

/**
 * Abstract authoring backend. Async by contract so a future worker-thread
 * offload (as `WorkerOxigraphStore` does for SPARQL) needs no interface change.
 */
export interface AuthoringBackend {
  /** Report engine / OSC / XSD versions — the capability probe's data source. */
  describe(): Promise<EngineInfo>

  /** Validate a `.xosc` document with the authoritative checker (schema ⊇ XSD). */
  validate(xosc: string, options?: AuthoringValidateOptions): Promise<AuthoringValidationResult>

  /** Whether the backend has loaded its engine and can serve without a cold start. */
  isReady(): Promise<boolean>

  /**
   * Release any held resources so the host process can exit cleanly. Idempotent
   * and safe to call when the engine was never loaded. Optional: a stateless
   * backend may omit it.
   */
  close?(): Promise<void>
}
