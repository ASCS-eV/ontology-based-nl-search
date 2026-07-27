/**
 * ASAM Quality Checker Framework interop — the `.xqar` result file.
 *
 * The gates in this package produce {@link AuthoringGap}s: a rule UID, a reason,
 * a focus node, sometimes a source location. `.xqar` is the framework's
 * interchange format for exactly that, so a gap set can be handed to the
 * framework's report modules instead of only to this repo's own UI, and a
 * bundle's results can be read back in as gaps instead of being reimplemented.
 *
 * Both directions live here because they are one contract: what
 * {@link gapsToXqar} writes, {@link parseXqar} must be able to read.
 *
 * STANDARDS (criterion #31):
 *   [QC-FW] ASAM Quality Checker Framework — `asam-ev/qc-framework`,
 *           `doc/schema/xqar_result_format.xsd` (element and attribute names,
 *           the `Locations` wrapper, `AddressedRule`) and
 *           `doc/manual/file_formats.md` (the `level` severity values, and the
 *           `Config`/`Param` shape a bundle is invoked with).
 */
import type { SceneGateName } from '@ontology-search/api-types'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'

import { QC_RULES, type QcRule } from './qc-rules.js'
import type { AuthoringGap } from './types.js'

/**
 * `.xqar` issue severity ([QC-FW]). The framework orders these ascending by
 * seriousness reversed — 1 is the worst — and filters on them via a config
 * file's `minLevel`/`maxLevel`.
 */
export const XQAR_LEVEL = {
  error: 1,
  warning: 2,
  information: 3,
} as const

export type XqarLevel = (typeof XQAR_LEVEL)[keyof typeof XQAR_LEVEL]

/** A `<FileLocation>`: 1-based row/column into the checked file. */
export interface XqarFileLocation {
  readonly row: number
  readonly column: number
}

/** One `<Issue>`, flattened with the `<Checker>` that owns it. */
export interface XqarIssue {
  readonly checkerId: string
  readonly ruleUid: string
  readonly description: string
  readonly level: XqarLevel
  readonly location?: XqarFileLocation
}

/** Identity of the emitting `<CheckerBundle>`. */
export interface XqarBundleIdentity {
  readonly name: string
  readonly version: string
  readonly description: string
  /** Free-form per [QC-FW]; kept caller-supplied so emission stays pure. */
  readonly buildDate: string
}

/** Options for {@link gapsToXqar}. */
export interface XqarEmitOptions {
  /** The checked file, echoed as the bundle's `InputFile` param. */
  readonly inputFile: string
  readonly bundle: XqarBundleIdentity
}

/**
 * Which checker owns a gate's findings. The framework models a checker as a unit
 * that addresses a set of rules, which is exactly what a gate is here, so the
 * mapping is gate → checker rather than rule → checker.
 */
function checkerIdFor(gate: SceneGateName): string {
  return `check_scene_${gate}_gate`
}

/**
 * Severity of a gate's findings ([QC-FW] `level`). Semantic and structural
 * findings make the pipeline invalid, so they are errors; residual findings
 * describe the input road network rather than the authored scene and are
 * warnings — the same line `repairableGaps` draws.
 */
const GATE_LEVEL: Record<SceneGateName, XqarLevel> = {
  semantic: XQAR_LEVEL.error,
  structural: XQAR_LEVEL.error,
  residual: XQAR_LEVEL.warning,
}

/**
 * Every rule UID a gate can attribute a finding to, for `<AddressedRule>`. Read
 * from the catalog, so a checker declares the rules it owns rather than only the
 * ones that happened to fire in this run.
 */
function addressedRules(gate: SceneGateName): string[] {
  return Object.values(QC_RULES as Record<string, QcRule>)
    .filter((rule) => rule.gate === gate)
    .map((rule) => rule.uid)
    .sort()
}

/**
 * The gap shape this emitter accepts: an {@link AuthoringGap} widened to any
 * scene gate, plus the optional source location the structural gate carries.
 * The structural gaps are produced in the pipeline (`@ontology-search/llm`)
 * rather than here, but they are part of the same report, so the emitter takes
 * the union instead of forcing the caller to split its gap set.
 */
export interface XqarGap extends Omit<AuthoringGap, 'gate'> {
  readonly gate: SceneGateName
  readonly location?: { readonly line: number; readonly col: number }
}

/**
 * Render gaps as a `.xqar` document ([QC-FW] `xqar_result_format.xsd`).
 *
 * One `<CheckerBundle>`, one `<Checker>` per gate that produced findings, one
 * `<Issue>` per gap. A gap that carries a source location gets a
 * `<Locations><FileLocation row column/></Locations>`; one that carries only a
 * focus node gets the focus node as the `Locations` description, because the
 * framework has no element-name location type and inventing an `XMLLocation`
 * xpath we did not compute would be worse than saying where we looked.
 */
export function gapsToXqar(gaps: readonly XqarGap[], options: XqarEmitOptions): string {
  const byGate = new Map<SceneGateName, XqarGap[]>()
  for (const gap of gaps) {
    const gate = gap.gate
    const bucket = byGate.get(gate)
    if (bucket) bucket.push(gap)
    else byGate.set(gate, [gap])
  }

  let issueId = 0
  const checkers = [...byGate.entries()].map(([gate, checkerGaps]) => {
    return {
      '@_checkerId': checkerIdFor(gate),
      '@_description': `Design-time ${gate} gate (${issueLabel(checkerGaps.length)})`,
      '@_summary': `${checkerGaps.length} issue(s)`,
      '@_status': 'completed',
      AddressedRule: addressedRules(gate).map((ruleUID) => ({ '@_ruleUID': ruleUID })),
      Issue: checkerGaps.map((gap) => ({
        '@_issueId': String(issueId++),
        '@_description': gap.reason,
        '@_level': String(GATE_LEVEL[gap.gate] ?? XQAR_LEVEL.error),
        '@_ruleUID': gap.ruleUid,
        Locations: {
          '@_description': gap.focusNode ?? gap.term,
          ...(gap.location
            ? {
                FileLocation: {
                  '@_row': String(gap.location.line),
                  '@_column': String(gap.location.col),
                },
              }
            : {}),
        },
      })),
    }
  })

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true,
  })
  return builder.build({
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    CheckerResults: {
      '@_version': '1.0.0',
      CheckerBundle: {
        '@_name': options.bundle.name,
        '@_version': options.bundle.version,
        '@_description': options.bundle.description,
        '@_build_date': options.bundle.buildDate,
        '@_summary': `${gaps.length} issue(s)`,
        Param: { '@_name': 'InputFile', '@_value': options.inputFile },
        Checker: checkers,
      },
    },
  }) as string
}

function issueLabel(count: number): string {
  return count === 1 ? '1 issue' : `${count} issues`
}

/**
 * Read a `.xqar` document into flat issues — the import half, used to consume
 * the results of a checker bundle run out of process instead of reimplementing
 * its rules.
 *
 * Tolerant by design: a bundle is a third-party program, so a missing optional
 * attribute yields a conservative value rather than an exception. A document
 * that is not `.xqar` at all yields an empty list.
 */
export function parseXqar(xml: string): XqarIssue[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(xml) as Record<string, unknown>
  const results = doc.CheckerResults as Record<string, unknown> | undefined
  if (!results) return []

  const issues: XqarIssue[] = []
  for (const bundle of asArray(results.CheckerBundle)) {
    for (const checker of asArray(bundle.Checker)) {
      const checkerId = String(checker['@_checkerId'] ?? '')
      for (const issue of asArray(checker.Issue)) {
        const location = firstFileLocation(issue.Locations)
        issues.push({
          checkerId,
          ruleUid: String(issue['@_ruleUID'] ?? ''),
          description: String(issue['@_description'] ?? ''),
          level: toLevel(issue['@_level']),
          ...(location ? { location } : {}),
        })
      }
    }
  }
  return issues
}

function firstFileLocation(locations: unknown): XqarFileLocation | undefined {
  for (const entry of asArray(locations)) {
    for (const file of asArray(entry.FileLocation)) {
      const row = Number(file['@_row'])
      const column = Number(file['@_column'])
      if (Number.isFinite(row) && Number.isFinite(column)) return { row, column }
    }
  }
  return undefined
}

function toLevel(raw: unknown): XqarLevel {
  const n = Number(raw)
  return n === XQAR_LEVEL.warning || n === XQAR_LEVEL.information ? n : XQAR_LEVEL.error
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (value === undefined || value === null) return []
  const list = Array.isArray(value) ? value : [value]
  return list.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
}
