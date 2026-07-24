/**
 * The deterministic scene pipeline — the authoring analog of the search
 * feature's `run-slot-pipeline.ts`.
 *
 * Given a validated authoring IR (the LLM's only output), it runs the three
 * authoring gates and lowers the IR to a `.xosc` document:
 *
 *   1. **Semantic gate** — SHACL/SPARQL over the IR instance graph: resolvable
 *      entity references (honoring `$param`), unique element names, and
 *      cross-file `.xosc`↔`.xodr` road resolution (packages/authoring-gate).
 *   2. **Lowering** — IR → `.xosc` via the model-generated writer facade
 *      (packages/authoring; the engine owns element order + `xsd:choice`).
 *   3. **Structural gate** — the in-process engine validates the emitted
 *      document against the OpenSCENARIO XSD/checker (the authoritative gate).
 *   4. **Residual gate** — analytic road-geometry G1/G2 continuity over the
 *      referenced `.xodr`, when one is supplied (else explicitly skipped).
 *
 * It is LLM-free and pure w.r.t. its inputs, so it is unit-testable end-to-end
 * against the real WASM engine without a model in the loop. The agent layer
 * (scene-agent.ts) wraps it in the bounded repair loop.
 *
 * Every violation is a {@link SceneGap} carrying a canonical `asam.net:…` qc
 * rule UID, so the repair prompt and the qc-framework speak the same rule
 * identity (criterion #31).
 */

// SceneGap/GateTrace/SceneGateName are the HTTP-boundary contract: defined once
// in the browser-safe api-types package and consumed by BOTH this server-side
// pipeline and the web client, so the shapes can never drift.
import type { GateTrace, SceneGap, SceneGateName } from '@ontology-search/api-types'
import { type AuthoringDiagnostic, getAuthoringBackend } from '@ontology-search/authoring'
import { QC_RULES, runResidualGate, runSemanticGate } from '@ontology-search/authoring-gate'
import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { defaultRoad, getRoad } from '@ontology-search/road-catalog'

export type { GateTrace, SceneGap, SceneGateName }

/**
 * Bind the road network the IR runs on to concrete `.xodr` bytes.
 *
 * Single-source safety ("what you validate is what you see"): the SAME bytes
 * feed the cross-file semantic check, the residual geometry gate, the qc/esmini
 * self-test, and the browser viewer. Precedence:
 *
 *   1. an explicit `roadNetworkXodr` (the caller owns the bytes — the IR is left
 *      untouched; used by `/author/refine` and tests);
 *   2. otherwise the curated catalog road named by `ir.roadNetwork.logicFile`;
 *   3. otherwise the default catalog road.
 *
 * In the catalog path the IR's `logicFile` is normalized to the bound road so
 * the emitted `.xosc` names exactly the road that was validated — never a silent
 * substitution where the gates check one road and the viewer renders another.
 */
export function bindCatalogRoad(
  ir: AuthoringIR,
  explicitXodr: string | undefined
): { readonly ir: AuthoringIR; readonly roadNetworkXodr: string } {
  if (explicitXodr !== undefined) {
    return { ir, roadNetworkXodr: explicitXodr }
  }
  const wanted = ir.roadNetwork?.logicFile
  const road = (wanted !== undefined ? getRoad(wanted) : undefined) ?? defaultRoad()
  return {
    ir: { ...ir, roadNetwork: { ...ir.roadNetwork, logicFile: road.logicFile } },
    roadNetworkXodr: road.xodr,
  }
}

export interface ScenePipelineInput {
  /** The authoring IR to gate and lower. */
  readonly ir: AuthoringIR
  /**
   * The referenced OpenDRIVE road network (`.xodr` content). When omitted, the
   * pipeline binds it from the road catalog (via {@link bindCatalogRoad}) so the
   * cross-file semantic check and the residual geometry gate always RUN on real
   * road bytes — never silently skipped. Pass it explicitly to override the
   * catalog with caller-supplied bytes (e.g. `/author/refine`).
   */
  readonly roadNetworkXodr?: string
  /** Cooperative cancellation, honoured at each gate boundary. */
  readonly signal?: AbortSignal
}

export interface SceneResult {
  /** The IR that was gated and lowered (echoed for the repair loop). */
  readonly ir: AuthoringIR
  /** The emitted `.xosc` document — present unless lowering threw. */
  readonly xosc?: string
  /** True iff the IR passed the semantic gate AND the engine's structural gate. */
  readonly valid: boolean
  /** All violations across gates, each rule-attributed. */
  readonly gaps: readonly SceneGap[]
  /** Raw engine diagnostics from the structural gate (warnings included). */
  readonly diagnostics: readonly AuthoringDiagnostic[]
  /** Per-gate verdicts, in evaluation order. */
  readonly trace: readonly GateTrace[]
}

/**
 * Run the full gate pipeline over an authoring IR and lower it to `.xosc`.
 *
 * Deterministic: the same IR (and optional road network) always yields the same
 * document and the same gaps. Rejects only on client abort — every other
 * failure surfaces as a rule-attributed gap so the caller never sees a silently
 * invalid result.
 */
export async function runScenePipeline(input: ScenePipelineInput): Promise<SceneResult> {
  const { ir, roadNetworkXodr } = bindCatalogRoad(input.ir, input.roadNetworkXodr)
  const { signal } = input
  const gaps: SceneGap[] = []
  const trace: GateTrace[] = []

  // ── 1. Semantic gate (design-time, IR-only) ────────────────────────────────
  const semantic = await runSemanticGate(ir, {
    roadNetworkXodr,
    ...(signal ? { signal } : {}),
  })
  gaps.push(...semantic.gaps)
  trace.push({
    gate: 'semantic',
    ok: semantic.ok,
    gapCount: semantic.gaps.length,
    ...(semantic.skipped ? { skipped: semantic.skipped } : {}),
  })

  // ── 2 + 3. Lower, then validate the emitted document (the structural gate) ──
  const backend = getAuthoringBackend()
  const structuralGaps: SceneGap[] = []
  let xosc: string | undefined
  let diagnostics: readonly AuthoringDiagnostic[] = []
  try {
    xosc = await backend.lower(ir, signal ? { signal } : undefined)
    const validation = await backend.validate(xosc, signal ? { signal } : undefined)
    diagnostics = validation.diagnostics
    for (const d of validation.diagnostics) {
      if (d.severity !== 'error') continue
      structuralGaps.push({
        term: d.message,
        reason: `OpenSCENARIO schema violation at line ${d.line}:${d.col}.`,
        ruleUid: d.ruleUid ?? QC_RULES.schemaValidation.uid,
        gate: 'structural',
        location: { line: d.line, col: d.col },
      })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    // A writer fault (the IR cannot be materialized) is a structural violation.
    structuralGaps.push({
      term: 'scene lowering',
      reason: error instanceof Error ? error.message : String(error),
      ruleUid: QC_RULES.schemaValidation.uid,
      gate: 'structural',
    })
  }
  gaps.push(...structuralGaps)
  const structuralOk = xosc !== undefined && structuralGaps.length === 0
  trace.push({ gate: 'structural', ok: structuralOk, gapCount: structuralGaps.length })

  // ── 4. Residual gate (road geometry) — over the bound road network ──────────
  const residual = await runResidualGate({ roadNetworkXodr }, signal ? { signal } : undefined)
  // Residual gaps describe the referenced `.xodr`, not the IR, so they are
  // reported for transparency but do NOT gate `valid` — the LLM cannot fix a
  // bad road network by editing the scene IR.
  gaps.push(...residual.gaps)
  trace.push({
    gate: 'residual',
    ok: residual.ok,
    gapCount: residual.gaps.length,
    ...(residual.skipped ? { skipped: residual.skipped } : {}),
  })

  return {
    ir,
    ...(xosc !== undefined ? { xosc } : {}),
    valid: semantic.ok && structuralOk,
    gaps,
    diagnostics,
    trace,
  }
}

/**
 * The subset of gaps a repair prompt can act on: those a change to the IR can
 * fix. Semantic (referential/uniqueness/cross-file) and structural (schema)
 * gaps are IR-fixable; residual road-geometry gaps are not (they belong to the
 * input `.xodr`), so they are excluded from repair feedback.
 */
export function repairableGaps(gaps: readonly SceneGap[]): readonly SceneGap[] {
  return gaps.filter((g) => g.gate !== 'residual')
}
