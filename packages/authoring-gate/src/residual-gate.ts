/**
 * The residual gate — the third validation gate, for qc rules out of reach of
 * both the SHACL semantic gate and the structural WASM checker.
 *
 * A pluggable `ResidualChecker` port (mirroring the `AUTHORING_MODE` backend
 * factory) selects a backend by `RESIDUAL_MODE`:
 *
 *   - **in-process** (default) — pure, deterministic analytic geometry over the
 *     lifted road network: G1 (heading) and G2 (curvature) continuity between
 *     consecutive `.xodr` planView primitives. No Python, no simulator.
 *   - **external** — an opt-in, out-of-process adapter (e.g. an esmini /
 *     qc-framework runner) for collision / physics / simulation-plausibility
 *     rules. Off by default; when no runner is configured those rules are
 *     reported `skipped`, never a false pass.
 *
 * Every violation carries the geometry-continuity rule UID (from {@link QC_RULES})
 * so residual gaps are attributed exactly like semantic gaps.
 *
 * [QC-XODR] ASAM OpenDRIVE checker bundle — road.geometry continuity family.
 * See RESIDUAL-QC.md for the rule → UID → backend coverage manifest.
 */
import { getConfig } from '@ontology-search/core/config'
import { XMLParser } from 'fast-xml-parser'

import { QC_RULES } from './qc-rules.js'
import type { AuthoringGap, GateResult } from './types.js'

/** Simulation-only rule families no in-process backend can decide. */
const SIMULATION_ONLY_RULES = [
  'asam.net:xosc:sim:no_collision_at_scenario_start',
  'asam.net:xosc:sim:reachable_target_within_horizon',
] as const

/** Angular / curvature tolerance for a continuity join (radians, 1/m). */
const TOLERANCE = 1e-3

/** Selected residual backend. */
export type ResidualMode = 'in-process' | 'external'

/** Input to a residual check. */
export interface ResidualCheckInput {
  /** The referenced OpenDRIVE road network (`.xodr` content). */
  readonly roadNetworkXodr?: string
}

/** Per-call options. */
export interface ResidualCheckOptions {
  readonly signal?: AbortSignal
}

/**
 * A residual-check backend. `mode` names the selected backend; `check` returns
 * UID-attributed gaps plus the rule UIDs it deliberately skipped.
 */
export interface ResidualChecker {
  readonly mode: ResidualMode
  check(input: ResidualCheckInput, options?: ResidualCheckOptions): Promise<GateResult>
}

// ---------------------------------------------------------------------------
// Analytic road geometry (the in-process backend's core).

interface GeometryPrimitive {
  readonly hdg: number
  readonly length: number
  /** Start / end curvature (1/m), 0 for straight lines. */
  readonly curvStart: number
  readonly curvEnd: number
}

function attr(node: Record<string, unknown>, key: string): number {
  const raw = node[`@_${key}`]
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
  return Number.isFinite(n) ? n : 0
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** Extract a primitive's start/end curvature from its shape child. */
function shapeCurvature(geometry: Record<string, unknown>): { start: number; end: number } {
  if (geometry.arc) {
    const c = attr(geometry.arc as Record<string, unknown>, 'curvature')
    return { start: c, end: c }
  }
  if (geometry.spiral) {
    const s = geometry.spiral as Record<string, unknown>
    return { start: attr(s, 'curvStart'), end: attr(s, 'curvEnd') }
  }
  // line / poly3 / paramPoly3 — treat as locally straight at the endpoints.
  return { start: 0, end: 0 }
}

/** Parse a road's planView into ordered geometry primitives. */
function parseRoadGeometries(road: Record<string, unknown>): GeometryPrimitive[] {
  const planView = road.planView as Record<string, unknown> | undefined
  if (!planView) return []
  return asArray(planView.geometry as Record<string, unknown> | Record<string, unknown>[]).map(
    (g) => {
      const { start, end } = shapeCurvature(g)
      return { hdg: attr(g, 'hdg'), length: attr(g, 'length'), curvStart: start, curvEnd: end }
    }
  )
}

/** Heading at the end of a primitive (start heading + integrated curvature). */
function endHeading(g: GeometryPrimitive): number {
  return g.hdg + ((g.curvStart + g.curvEnd) / 2) * g.length
}

/** Normalize an angle difference to (-π, π]. */
function normalizeAngle(a: number): number {
  let x = a
  while (x > Math.PI) x -= 2 * Math.PI
  while (x <= -Math.PI) x += 2 * Math.PI
  return x
}

/** Analytic G1/G2 continuity check over one lifted `.xodr`. */
export function checkGeometryContinuity(xodr: string): AuthoringGap[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(xodr) as Record<string, unknown>
  const root = (doc.OpenDRIVE ?? {}) as Record<string, unknown>
  const gaps: AuthoringGap[] = []

  asArray(root.road as Record<string, unknown> | Record<string, unknown>[]).forEach(
    (road, roadIndex) => {
      const roadId = String(road['@_id'] ?? roadIndex)
      const geometries = parseRoadGeometries(road)
      for (let i = 1; i < geometries.length; i++) {
        const prev = geometries[i - 1]!
        const next = geometries[i]!
        const focus = `road ${roadId} geometry[${i}]`
        const headingGap = Math.abs(normalizeAngle(endHeading(prev) - next.hdg))
        if (headingGap > TOLERANCE) {
          gaps.push(
            residualGap(
              focus,
              `G1 (heading) discontinuity at ${focus}: Δheading=${headingGap.toFixed(4)} rad.`
            )
          )
        }
        const curvatureGap = Math.abs(prev.curvEnd - next.curvStart)
        if (curvatureGap > TOLERANCE) {
          gaps.push(
            residualGap(
              focus,
              `G2 (curvature) discontinuity at ${focus}: Δcurvature=${curvatureGap.toFixed(4)} 1/m.`
            )
          )
        }
      }
    }
  )
  return gaps
}

function residualGap(focusNode: string, reason: string): AuthoringGap {
  return {
    term: focusNode,
    reason,
    ruleUid: QC_RULES.geometryContinuity.uid,
    gate: 'residual',
    focusNode,
  }
}

// ---------------------------------------------------------------------------
// Backends.

/** The default backend: in-process analytic geometry; simulation rules skipped. */
export class InProcessResidualChecker implements ResidualChecker {
  readonly mode = 'in-process' as const

  async check(input: ResidualCheckInput, options?: ResidualCheckOptions): Promise<GateResult> {
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const gaps = input.roadNetworkXodr ? checkGeometryContinuity(input.roadNetworkXodr) : []
    return { ok: gaps.length === 0, gaps, skipped: [...SIMULATION_ONLY_RULES] }
  }
}

/**
 * The opt-in external backend. It runs the same in-process analytic geometry
 * check (always valuable) and would additionally invoke an out-of-process
 * simulator for the collision/physics rules. No runner is wired in-repo, so
 * those rules are reported `skipped` (never a false pass) — the seam is real,
 * the fabrication is not.
 */
export class ExternalResidualChecker implements ResidualChecker {
  readonly mode = 'external' as const

  async check(input: ResidualCheckInput, options?: ResidualCheckOptions): Promise<GateResult> {
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const gaps = input.roadNetworkXodr ? checkGeometryContinuity(input.roadNetworkXodr) : []
    // A configured simulator would evaluate SIMULATION_ONLY_RULES here.
    return { ok: gaps.length === 0, gaps, skipped: [...SIMULATION_ONLY_RULES] }
  }
}

/**
 * Select the residual backend by `RESIDUAL_MODE` (default `in-process`), exactly
 * as `getAuthoringBackend()` selects by `AUTHORING_MODE`.
 */
export function getResidualChecker(mode?: ResidualMode): ResidualChecker {
  const selected = mode ?? getConfig().RESIDUAL_MODE
  return selected === 'external' ? new ExternalResidualChecker() : new InProcessResidualChecker()
}

/** Run the residual gate with the config-selected backend. */
export async function runResidualGate(
  input: ResidualCheckInput,
  options?: ResidualCheckOptions
): Promise<GateResult> {
  return getResidualChecker().check(input, options)
}
