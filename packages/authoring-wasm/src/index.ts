/**
 * @ontology-search/authoring-wasm — the in-process OpenSCENARIO WASM engine.
 *
 * The RA Consulting `openscenario.api.test` C++ API (Apache-2.0) compiled to
 * WebAssembly and loaded in-process, exactly like Oxigraph WASM in
 * packages/sparql. It authors, serializes and validates OpenSCENARIO 1.3 with
 * precise, element-attributed diagnostics — the authoritative checker the
 * NL→.xosc authoring loop calls behind the SSE API.
 */
export { loadOscEngine } from './engine.js'
export type {
  Diagnostic,
  EngineFiles,
  EngineInfo,
  OscEngine,
  Severity,
  ValidationResult,
} from './types.js'
