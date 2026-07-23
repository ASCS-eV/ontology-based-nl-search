/**
 * `@ontology-search/authoring-gate` — the design-time half of authoring
 * validation: a SHACL/SPARQL **semantic gate** (referential, uniqueness,
 * cross-file `.xosc`↔`.xodr` resolution) and an analytic **residual gate**
 * (road-geometry G1/G2 continuity), both over the in-process Oxigraph store.
 *
 * This is the authoring-domain analog of `packages/search`: it turns a validated
 * {@link AuthoringIR} into rule-attributed gaps the LLM repair loop (task 05)
 * consumes uniformly with the search feature's gaps.
 */
export { GATE_NS, irToRdf, OPENDRIVE_NS, OSC_NS } from './ir-to-rdf.js'
export { QC_RULES, type QcRule, type QcRuleKey } from './qc-rules.js'
export {
  checkGeometryContinuity,
  ExternalResidualChecker,
  getResidualChecker,
  InProcessResidualChecker,
  type ResidualChecker,
  type ResidualCheckInput,
  type ResidualCheckOptions,
  type ResidualMode,
  runResidualGate,
} from './residual-gate.js'
export { runSemanticGate, type SemanticGateOptions } from './semantic-gate.js'
export type { AuthoringGap, GateName, GateResult } from './types.js'
