/**
 * SHACL-validator shapes loading & indexing (ADR 0003) — reads the workspace
 * Turtle into an RDF dataset (stripping engine-unsupported SHACL-Advanced
 * constraints) and builds the property→target-class and property→constraint
 * indexes the validator's fast path reads. Pure functions over RDF datasets.
 *
 * @see https://www.w3.org/TR/shacl/
 */
import { readFileSync } from 'node:fs'

import { createComponentLogger } from '@ontology-search/core/logging'
import { iri, RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import datasetFactory from '@rdfjs/dataset'
import type { DatasetCore, NamedNode, Quad, Term } from '@rdfjs/types'
import { DataFactory, Parser } from 'n3'

import { discoverShapeFiles } from './sources.js'

const log = createComponentLogger('shacl-validator')
const { namedNode } = DataFactory
const SH_NS = RDF_PREFIXES.sh

export function loadShapesFromDisk(): DatasetCore {
  const ds = datasetFactory.dataset()
  const parser = new Parser()

  for (const { path: filePath } of discoverShapeFiles({ includeOwl: true })) {
    const turtle = readFileSync(filePath, 'utf-8')
    try {
      const quads = parser.parse(turtle)
      for (const q of quads) ds.add(q as unknown as Quad)
    } catch (err) {
      log.warn('Failed to parse SHACL file', { file: filePath, error: String(err) })
    }
  }

  // Strip SHACL-Advanced constraints rdf-validate-shacl (Zazuko, Core
  // only) can't evaluate. When the engine encounters one of these on a
  // shape we ARE validating against, it throws
  // `Cannot find validator for constraint component <iri>` and aborts
  // the entire validation — taking out every slot under that target
  // class. Removing the triple severs the shape→constraint link; the
  // rest of the Core constraints on the same shape (sh:pattern, sh:in,
  // sh:datatype, …) continue to validate normally.
  //
  // Trade-off: any data-quality rule expressed as `sh:sparql` becomes a
  // no-op for the slot-validation gate. The compiler / store still
  // enforce structural correctness; only the bespoke SPARQL-encoded
  // check is dropped. A single info-level log line records the strip so
  // the operator can verify which shapes are affected.
  stripUnsupportedConstraints(ds)
  return ds
}

/**
 * Predicates whose object encodes a SHACL constraint that
 * `rdf-validate-shacl` 0.6 doesn't implement. Each triple gets removed
 * from the working dataset; the constraint node graphs become
 * orphaned, which the validator ignores.
 */
const UNSUPPORTED_CONSTRAINT_PREDICATES: readonly string[] = [
  `${SH_NS}sparql`,
  // SHACL-Advanced node-expression / rule predicates that show up in
  // some published ontologies and trigger the same constraint-lookup
  // error path. Kept conservative — extend when the validator throws
  // on a different predicate.
  `${SH_NS}rule`,
  `${SH_NS}values`,
]

function stripUnsupportedConstraints(ds: DatasetCore): void {
  const toRemove: Quad[] = []
  for (const unsupported of UNSUPPORTED_CONSTRAINT_PREDICATES) {
    const pred = namedNode(unsupported)
    for (const q of ds.match(null, pred, null, null)) toRemove.push(q as Quad)
  }
  if (toRemove.length === 0) return
  for (const q of toRemove) ds.delete(q)
  const breakdown = new Map<string, number>()
  for (const q of toRemove) {
    const key = q.predicate.value
    breakdown.set(key, (breakdown.get(key) ?? 0) + 1)
  }
  log.info(
    'Stripped SHACL-Advanced constraints rdf-validate-shacl cannot evaluate; affected shapes pass Core-only validation downstream',
    { breakdown: Object.fromEntries(breakdown) }
  )
}

// ─── Internal: property → target class index ─────────────────────────────────

/**
 * Build an index of property IRI → target class IRI(s) by inspecting every
 * sh:NodeShape with a sh:targetClass and walking its sh:property paths.
 *
 * SHACL allows the same property to appear on multiple shapes; we keep all
 * target classes so the validator can iterate them.
 */
export function indexPropertyTargetClasses(shapes: DatasetCore): Map<string, string[]> {
  const SH_PROPERTY = `${SH_NS}property`
  const SH_PATH = `${SH_NS}path`
  const SH_TARGET_CLASS = `${SH_NS}targetClass`

  // Step 1: shape → targetClass
  const shapeTargets = new Map<string, string[]>()
  for (const q of shapes.match(null, namedNode(SH_TARGET_CLASS), null, null)) {
    if (q.object.termType !== 'NamedNode') continue
    const subjectKey = termKey(q.subject)
    const existing = shapeTargets.get(subjectKey) ?? []
    existing.push(q.object.value)
    shapeTargets.set(subjectKey, existing)
  }

  // Step 2: shape → property-shape(s) → path
  const index = new Map<string, Set<string>>()
  for (const propLink of shapes.match(null, namedNode(SH_PROPERTY), null, null)) {
    const targets = shapeTargets.get(termKey(propLink.subject))
    if (!targets || targets.length === 0) continue

    for (const pathQ of shapes.match(propLink.object as Term, namedNode(SH_PATH), null, null)) {
      // We only handle the simple-path case (predicate IRI) — sequence/inverse
      // paths are out of scope for slot validation.
      if (pathQ.object.termType !== 'NamedNode') continue
      const propIri = pathQ.object.value
      const set = index.get(propIri) ?? new Set<string>()
      for (const t of targets) set.add(t)
      index.set(propIri, set)
    }
  }

  // Convert to plain arrays for stable iteration.
  const out = new Map<string, string[]>()
  for (const [k, v] of index) out.set(k, [...v])
  return out
}

function termKey(t: Term): string {
  return `${t.termType}:${t.value}`
}

/**
 * Build a fast-path constraint index: property IRI → { patterns, inValues, datatypeOnly }.
 *
 * Extracts sh:pattern, sh:in, and sh:datatype from every property shape in
 * the graph. For property shapes that have ONLY sh:datatype (no sh:pattern,
 * no sh:in, no sh:minLength, no sh:maxLength, no sh:hasValue, no sh:class,
 * no sh:nodeKind) the constraint is trivial: any value of the right type
 * will pass. We mark these as `datatypeOnly: true` so the fast path can
 * short-circuit immediately.
 *
 * This is fully generic — reads only standard SHACL vocabulary, works with
 * any shapes graph.
 */
export function indexPropertyConstraints(
  shapes: DatasetCore
): Map<string, { patterns: RegExp[]; inValues: Set<string> | null; datatypeOnly: boolean }> {
  const SH_PROPERTY = `${SH_NS}property`
  const SH_PATH = `${SH_NS}path`
  const SH_PATTERN = `${SH_NS}pattern`
  const SH_IN = `${SH_NS}in`
  const SH_DATATYPE = `${SH_NS}datatype`
  const RDF_FIRST = iri('rdf', 'first')
  const RDF_REST = iri('rdf', 'rest')
  const RDF_NIL = iri('rdf', 'nil')

  // Value-constraining SHACL components that, if present, mean datatype alone
  // is NOT sufficient for validation — the engine must run.
  const VALUE_CONSTRAINT_PREDS = [
    `${SH_NS}minLength`,
    `${SH_NS}maxLength`,
    `${SH_NS}minInclusive`,
    `${SH_NS}maxInclusive`,
    `${SH_NS}minExclusive`,
    `${SH_NS}maxExclusive`,
    `${SH_NS}hasValue`,
    `${SH_NS}class`,
    `${SH_NS}nodeKind`,
    `${SH_NS}languageIn`,
    `${SH_NS}uniqueLang`,
    `${SH_NS}node`,
    `${SH_NS}qualifiedValueShape`,
  ]

  const index = new Map<
    string,
    { patterns: RegExp[]; inValues: Set<string> | null; datatypeOnly: boolean }
  >()

  // Walk all property shapes
  for (const propLink of shapes.match(null, namedNode(SH_PROPERTY), null, null)) {
    const propShape = propLink.object as Term

    // Get path (property IRI)
    let propIri: string | null = null
    for (const pathQ of shapes.match(propShape, namedNode(SH_PATH), null, null)) {
      if (pathQ.object.termType === 'NamedNode') {
        propIri = pathQ.object.value
        break
      }
    }
    if (!propIri) continue

    const entry = index.get(propIri) ?? {
      patterns: [],
      inValues: null,
      datatypeOnly: false,
    }

    // Check if this shape has sh:datatype
    let hasDatatype = false
    for (const dtQ of shapes.match(propShape, namedNode(SH_DATATYPE), null, null)) {
      if (dtQ.object.termType === 'NamedNode') hasDatatype = true
    }

    // Extract sh:pattern (deduplicate by source string)
    let hasPattern = false
    for (const patQ of shapes.match(propShape, namedNode(SH_PATTERN), null, null)) {
      if (patQ.object.termType === 'Literal') {
        hasPattern = true
        try {
          const source = patQ.object.value
          // SHACL patterns are anchored (must match entire string)
          if (!entry.patterns.some((r) => r.source === `^${source}$`)) {
            entry.patterns.push(new RegExp(`^${source}$`))
          }
        } catch {
          // Invalid regex — skip
        }
      }
    }

    // Extract sh:in (RDF list)
    let hasIn = false
    for (const inQ of shapes.match(propShape, namedNode(SH_IN), null, null)) {
      hasIn = true
      const values = new Set<string>()
      let node: Term = inQ.object as Term
      while (node.value !== RDF_NIL) {
        for (const firstQ of shapes.match(node as NamedNode, namedNode(RDF_FIRST), null, null)) {
          if (firstQ.object.termType === 'Literal') {
            values.add(firstQ.object.value)
          } else if (firstQ.object.termType === 'NamedNode') {
            values.add(firstQ.object.value)
          }
        }
        let next: Term | null = null
        for (const restQ of shapes.match(node as NamedNode, namedNode(RDF_REST), null, null)) {
          next = restQ.object as Term
        }
        if (!next) break
        node = next
      }
      if (values.size > 0) {
        entry.inValues = entry.inValues ? new Set([...entry.inValues, ...values]) : values
      }
    }

    // Detect datatype-only: has sh:datatype but no value-constraining components.
    // A previous property shape for the same IRI may already have set patterns or
    // inValues — if so, this shape doesn't qualify as datatypeOnly.
    if (
      hasDatatype &&
      !hasPattern &&
      !hasIn &&
      entry.patterns.length === 0 &&
      entry.inValues === null
    ) {
      let hasOtherConstraint = false
      for (const pred of VALUE_CONSTRAINT_PREDS) {
        let found = false
        for (const _q of shapes.match(propShape, namedNode(pred), null, null)) {
          found = true
          break
        }
        if (found) {
          hasOtherConstraint = true
          break
        }
      }
      if (!hasOtherConstraint) {
        entry.datatypeOnly = true
      }
    }

    // Index this property if it has any fast-path-eligible information
    if (entry.patterns.length > 0 || entry.inValues !== null || entry.datatypeOnly) {
      index.set(propIri, entry)
    }
  }

  return index
}

// ─── Internal: candidate dataset construction ────────────────────────────────

/**
 * Build the minimal data graph the SHACL engine needs to evaluate one slot:
 *
 *   _:b a <targetClass> ;
 *       <propertyIri> <value> .
 *
 * The literal is typed naively (string by default; numbers/booleans get the
 * matching xsd datatype) so sh:datatype constraints fire correctly. SHACL
 * itself enforces any further pattern / range / enum rules.
 */
