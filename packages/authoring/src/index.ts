/**
 * @ontology-search/authoring — the authoring backend seam.
 *
 * `getAuthoringBackend()` on `AUTHORING_MODE` (mirrors `getSparqlStore()` on
 * `SPARQL_MODE`): `wasm` (default) loads the in-process OpenSCENARIO engine;
 * `null` is a deterministic no-engine backend for tests / the pipeline.
 */
import { getConfig } from '@ontology-search/core/config'

import type { AuthoringBackend } from './backend.js'
import { NullAuthoringBackend } from './null-backend.js'
import { WasmAuthoringBackend } from './wasm-backend.js'

let instance: AuthoringBackend | null = null

/**
 * Get the singleton authoring backend selected by validated config.
 *
 * Synchronous and single-threaded — the check-then-assign cannot interleave,
 * so there is no race (same reasoning as `getSparqlStore()`).
 */
export function getAuthoringBackend(): AuthoringBackend {
  if (instance) return instance
  const config = getConfig()
  instance =
    config.AUTHORING_MODE === 'null' ? new NullAuthoringBackend() : new WasmAuthoringBackend()
  return instance
}

/**
 * Release the singleton backend and clear it so a later `getAuthoringBackend()`
 * builds a fresh one. Call from the host's graceful-shutdown handler.
 * Idempotent: a no-op when no backend has been created.
 */
export async function closeAuthoringBackend(): Promise<void> {
  if (!instance) return
  const backend = instance
  instance = null
  await backend.close?.()
}

export type {
  AuthoringBackend,
  AuthoringDiagnostic,
  AuthoringValidateOptions,
  AuthoringValidationResult,
  EngineFiles,
  EngineInfo,
  Severity,
} from './backend.js'
export type { ExpectedEngine } from './capability-probe.js'
export { EXPECTED_ENGINE, probeEngineVersions } from './capability-probe.js'
export { NullAuthoringBackend } from './null-backend.js'
export { WasmAuthoringBackend } from './wasm-backend.js'
