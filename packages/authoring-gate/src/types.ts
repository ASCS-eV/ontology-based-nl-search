/**
 * Result shapes for the authoring gates.
 *
 * A gate violation is an {@link OntologyGap} — the SAME shape the search feature
 * already emits — extended with the qc rule identity (`ruleUid`) and the RDF
 * focus node it was found on, so the repair loop (task 05) consumes one uniform,
 * rule-attributed gap type across search and authoring.
 */
import type { OntologyGap } from '@ontology-search/api-types'

/** Which gate produced a violation. */
export type GateName = 'semantic' | 'residual'

/**
 * A gate violation. `ruleUid` is the canonical `asam.net:…` UID (never
 * fabricated — sourced from {@link QC_RULES}); `focusNode` is the offending
 * element (an entity name, a parameter name, a road id, …) when the gate can
 * localize it.
 */
export interface AuthoringGap extends OntologyGap {
  /** The qc rule UID this violation is attributed to. */
  readonly ruleUid: string
  /** The gate that produced it. */
  readonly gate: GateName
  /** The localized offending element, when available. */
  readonly focusNode?: string
}

/** The verdict of one gate: `ok` iff it produced zero violations. */
export interface GateResult {
  readonly ok: boolean
  readonly gaps: readonly AuthoringGap[]
  /**
   * Rule UIDs the gate deliberately did NOT evaluate (e.g. simulation-only
   * residual rules with no backend configured). Recorded so an un-evaluated rule
   * is explicit — it is never silently treated as a pass.
   */
  readonly skipped?: readonly string[]
}
