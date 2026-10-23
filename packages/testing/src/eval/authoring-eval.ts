/**
 * Authoring eval harness: per-field agreement, gap detection and gate
 * outcomes of authored scenes against a fixture set of `{ request, fields,
 * gaps }` cases.
 *
 * The harness is generic — every ontology name lives in the case fixtures. A
 * case asserts individual IR fields, not whole scenes, so a miss names the
 * field; the metrics follow the per-field and per-stage counts the
 * text-to-scenario literature reports. Two modes share the scoring:
 * deterministic replay of recorded submissions through the gate pipeline
 * ({@link replayRecorded}, run in CI) and a live provider (report-only, see
 * `run-authoring-eval.ts`).
 *
 * A gate that skipped rules is reported as skipped, never as a pass.
 */
import type { GateTrace, SceneResult, SceneSubmissionParams } from '@ontology-search/llm/authoring'
import { runScenePipeline } from '@ontology-search/llm/authoring'

export type AuthoredIR = SceneResult['ir']

/**
 * An entity named by what it does in the scene. The prompt leaves every
 * entity `ref` to the model, so a case that named entities by ref would score
 * a correct scene as missing every field of an entity the model named
 * differently.
 */
export type EntityRole =
  /** The one entity that acts in an action of this kind. */
  | { performs: string }
  /** The one entity that acts in no action of this kind. */
  | { performsNo: string }

export interface AuthoringCase {
  name: string
  /** The natural-language request (live mode). */
  request: string
  archetype?: string
  /**
   * Field path → expected value. Paths: `entities.count`, `entities.types`
   * (sorted, comma-joined), `actions.kinds` (sorted, comma-joined),
   * `entity.<ref>.<property>`, `action.<actor>.<kind>.<property>`,
   * `action.<actor>.<kind>.references.<name>`, `parameters.<name>`,
   * `roadNetwork.logicFile`, `stopTime`, `archetype`. A list value is
   * comma-joined.
   */
  fields: Record<string, string>
  /**
   * Role name → role. A role name used as `<ref>` or `<actor>` in a field
   * path stands for the entity the role picks, and a reference to that entity
   * reads as the role name. A role no entity or several entities fill picks
   * none, so its fields miss.
   */
  roles?: Record<string, EntityRole>
  /** Concepts the model must report as gaps (matched in a gap's term or reason). */
  gaps: string[]
  /** The validity the pipeline must end with; omitted = not asserted. */
  valid?: boolean
  /** false = report-only diagnostic, excluded from thresholds. */
  gating: boolean
}

/** What both modes produce for a case: the gated IR and how it was reached. */
export interface Authored {
  ir: AuthoredIR
  valid: boolean
  trace: readonly GateTrace[]
  reportedGaps: readonly { term: string; reason: string }[]
  attempts: number
}

export type AuthorFn = (evalCase: AuthoringCase) => Promise<Authored>

export interface FieldOutcome {
  field: string
  expected: string
  actual: string | undefined
  agree: boolean
}

export interface GapOutcome {
  concept: string
  /** Expected and reported; expected but absent; reported but not expected. */
  outcome: 'reported' | 'dropped' | 'invented'
}

export interface GateOutcome {
  gate: string
  outcome: 'pass' | 'fail' | 'skipped'
  skippedRules: readonly string[]
}

export interface AuthoringCaseResult {
  name: string
  gating: boolean
  fields: FieldOutcome[]
  /** Agreeing fields over expected fields; 1 when the case asserts none. */
  fieldAgreement: number
  gaps: GapOutcome[]
  gates: GateOutcome[]
  valid: boolean
  validAsExpected: boolean
  attempts: number
  durationMs: number
}

export interface AuthoringGatingSummary {
  cases: number
  meanFieldAgreement: number
  fieldMisses: number
  gapsDropped: number
  gapsInvented: number
  gatesSkipped: number
  /** Cases whose validity differs from the one asserted. */
  validityMisses: number
}

export interface AuthoringEvalSummary {
  results: AuthoringCaseResult[]
  gating: AuthoringGatingSummary
  /** Fixed-width report table for humans. */
  table: string
}

const join = (value: string | string[] | undefined): string | undefined =>
  value === undefined ? undefined : Array.isArray(value) ? value.join(',') : value

/** The ref of the one entity `role` picks in `ir`; undefined when none or several fit. */
export function roleRef(ir: AuthoredIR, role: EntityRole): string | undefined {
  const acts = (ref: string, kind: string): boolean =>
    ir.actions.some((a) => a.actor === ref && a.kind === kind)
  const fits = ir.entities
    .map((e) => e.ref)
    .filter((ref) => ('performs' in role ? acts(ref, role.performs) : !acts(ref, role.performsNo)))
  return fits.length === 1 ? fits[0] : undefined
}

/** The value a field path names in the IR, as a string; undefined when absent. */
export function fieldValue(
  ir: AuthoredIR,
  path: string,
  roles: Readonly<Record<string, EntityRole>> = {}
): string | undefined {
  const parts = path.split('.')
  const refOf = (name: string | undefined): string | undefined => {
    const role = name === undefined ? undefined : roles[name]
    return role ? roleRef(ir, role) : name
  }
  const roleOf = (ref: string | undefined): string | undefined =>
    Object.keys(roles).find((name) => ref !== undefined && refOf(name) === ref) ?? ref
  switch (parts[0]) {
    case 'entities':
      if (parts[1] === 'count') return String(ir.entities.length)
      if (parts[1] === 'types') return [...ir.entities.map((e) => e.type)].sort().join(',')
      return undefined
    case 'actions':
      if (parts[1] === 'kinds') return [...ir.actions.map((a) => a.kind)].sort().join(',')
      return undefined
    case 'entity': {
      const [, name, property] = parts
      const ref = refOf(name)
      const entity = ref === undefined ? undefined : ir.entities.find((e) => e.ref === ref)
      return property === undefined ? undefined : join(entity?.properties[property])
    }
    case 'action': {
      const [, actorName, kind, property, name] = parts
      const actor = refOf(actorName)
      const action =
        actor === undefined
          ? undefined
          : ir.actions.find((a) => a.actor === actor && a.kind === kind)
      if (!action || property === undefined) return undefined
      if (property === 'references')
        return name === undefined ? undefined : roleOf(action.references?.[name])
      return join(action.properties[property])
    }
    case 'parameters':
      return parts[1] === undefined ? undefined : ir.parameters?.[parts[1]]
    case 'roadNetwork':
      return parts[1] === 'logicFile' ? ir.roadNetwork?.logicFile : undefined
    case 'stopTime':
      return ir.stopTime === undefined ? undefined : String(ir.stopTime)
    case 'archetype':
      return ir.archetype
    default:
      return undefined
  }
}

/** Score one authored case. Pure. */
export function scoreCase(
  evalCase: AuthoringCase,
  authored: Authored,
  durationMs: number
): AuthoringCaseResult {
  const fields = Object.entries(evalCase.fields).map(([field, expected]) => {
    const actual = fieldValue(authored.ir, field, evalCase.roles)
    return { field, expected, actual, agree: actual === expected }
  })
  const fieldAgreement =
    fields.length === 0 ? 1 : fields.filter((f) => f.agree).length / fields.length

  const reported = authored.reportedGaps.map((gap) => ({
    gap,
    text: `${gap.term} ${gap.reason}`.toLowerCase(),
  }))
  const matched = new Set<number>()
  const gaps: GapOutcome[] = evalCase.gaps.map((concept) => {
    const index = reported.findIndex((r) => r.text.includes(concept.toLowerCase()))
    if (index >= 0) matched.add(index)
    return { concept, outcome: index >= 0 ? 'reported' : 'dropped' }
  })
  reported.forEach((r, index) => {
    if (!matched.has(index)) gaps.push({ concept: r.gap.term, outcome: 'invented' })
  })

  const gates: GateOutcome[] = authored.trace.map((t) => ({
    gate: t.gate,
    outcome: t.skipped && t.skipped.length > 0 ? 'skipped' : t.ok ? 'pass' : 'fail',
    skippedRules: t.skipped ?? [],
  }))

  return {
    name: evalCase.name,
    gating: evalCase.gating,
    fields,
    fieldAgreement,
    gaps,
    gates,
    valid: authored.valid,
    validAsExpected: evalCase.valid === undefined || authored.valid === evalCase.valid,
    attempts: authored.attempts,
    durationMs,
  }
}

/** Run every case through `author` and aggregate the gating metrics. */
export async function evaluateAuthoring(
  author: AuthorFn,
  cases: AuthoringCase[]
): Promise<AuthoringEvalSummary> {
  const results: AuthoringCaseResult[] = []
  for (const evalCase of cases) {
    const startedAt = Date.now()
    const authored = await author(evalCase)
    results.push(scoreCase(evalCase, authored, Date.now() - startedAt))
  }
  const gatingResults = results.filter((r) => r.gating)
  const count = (pick: (r: AuthoringCaseResult) => number): number =>
    gatingResults.reduce((sum, r) => sum + pick(r), 0)
  const gating: AuthoringGatingSummary = {
    cases: gatingResults.length,
    meanFieldAgreement:
      gatingResults.length === 0 ? 1 : count((r) => r.fieldAgreement) / gatingResults.length,
    fieldMisses: count((r) => r.fields.filter((f) => !f.agree).length),
    gapsDropped: count((r) => r.gaps.filter((g) => g.outcome === 'dropped').length),
    gapsInvented: count((r) => r.gaps.filter((g) => g.outcome === 'invented').length),
    gatesSkipped: count((r) => r.gates.filter((g) => g.outcome === 'skipped').length),
    validityMisses: count((r) => (r.validAsExpected ? 0 : 1)),
  }
  return { results, gating, table: renderTable(results) }
}

/**
 * The deterministic mode: each case's recorded submission, replayed through
 * the gate pipeline. No model runs, so the result is the same on every
 * machine and the harness can gate CI.
 */
export function replayRecorded(
  recordings: Readonly<Record<string, SceneSubmissionParams>>,
  pipeline: typeof runScenePipeline = runScenePipeline
): AuthorFn {
  return async (evalCase) => {
    const submission = recordings[evalCase.name]
    if (!submission) throw new Error(`No recorded submission for case "${evalCase.name}"`)
    const result = await pipeline({ ir: submission.scene as AuthoredIR })
    return {
      ir: result.ir,
      valid: result.valid,
      trace: result.trace,
      reportedGaps: submission.gaps,
      attempts: 1,
    }
  }
}

function renderTable(results: AuthoringCaseResult[]): string {
  const header = [
    'case',
    'gate',
    'fields',
    'gaps r/d/i',
    'gates p/f/s',
    'valid',
    'tries',
    'ms',
    'misses',
  ]
  const tally = (outcomes: string[], keys: string[]): string =>
    keys.map((k) => outcomes.filter((o) => o === k).length).join('/')
  const rows = results.map((r) => [
    r.name,
    r.gating ? 'yes' : 'no',
    `${r.fields.filter((f) => f.agree).length}/${r.fields.length}`,
    tally(
      r.gaps.map((g) => g.outcome),
      ['reported', 'dropped', 'invented']
    ),
    tally(
      r.gates.map((g) => g.outcome),
      ['pass', 'fail', 'skipped']
    ),
    `${r.valid ? 'yes' : 'no'}${r.validAsExpected ? '' : '!'}`,
    String(r.attempts),
    String(r.durationMs),
    r.fields
      .filter((f) => !f.agree)
      .map((f) => `${f.field}=${f.actual ?? '∅'}≠${f.expected}`)
      .join(' '),
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)))
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ')
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n')
}
