/**
 * SHACL-validator candidate-dataset synthesis & result mapping (ADR 0003) —
 * builds the minimal `_:b a <targetClass> ; <propertyIri> <value>` datasets the
 * engine validates, the per-(property,value,target) cache key, and the
 * ValidationReport → ShaclViolation mapping. Pure functions.
 *
 * @see https://www.w3.org/TR/shacl/
 */
import { iri, RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import datasetFactory from '@rdfjs/dataset'
import type { DatasetCore, NamedNode, Term } from '@rdfjs/types'
import { DataFactory } from 'n3'

import type { ShaclViolation } from './shacl-validator-types.js'

const { namedNode, blankNode, literal, quad } = DataFactory
const SH_NS = RDF_PREFIXES.sh

/** Extract local name from an IRI (after last / or #). */
export function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/**
 * Build the per-value candidate dataset `_:b a <targetClass> ; <propertyIri>
 * <value>` that the SHACL engine validates against the shapes for that class.
 */
export function buildCandidateDataset(
  propertyIri: string,
  value: string | number | boolean,
  targetClass: string
): DatasetCore {
  const ds = datasetFactory.dataset()
  const subject = blankNode()
  const rdfType = namedNode(iri('rdf', 'type'))

  ds.add(quad(subject, rdfType, namedNode(targetClass)))
  ds.add(quad(subject, namedNode(propertyIri), toLiteralOrIri(value)))
  return ds
}

/**
 * Build a single dataset containing one named focus node per candidate value.
 * Named (rather than blank) so the resulting `ValidationReport.results[].focusNode`
 * carries a stable IRI we can map back to the original value.
 *
 *   <urn:shacl-validator:candidate:0> a <Class> ; <prop> "DE" .
 *   <urn:shacl-validator:candidate:1> a <Class> ; <prop> "europe" .
 *   ...
 *
 * The `urn:shacl-validator:` prefix is internal — user-supplied values are
 * never named nodes themselves (we only validate literal slot values), so
 * there is no collision risk.
 */
const FOCUS_IRI_PREFIX = 'urn:shacl-validator:candidate:'

export function buildBatchCandidateDataset(
  propertyIri: string,
  values: ReadonlyArray<string | number | boolean>,
  targetClass: string
): { dataset: DatasetCore; valueToFocusIri: Map<string, string> } {
  const ds = datasetFactory.dataset()
  const rdfType = namedNode(iri('rdf', 'type'))
  const cls = namedNode(targetClass)
  const propNode = namedNode(propertyIri)
  const valueToFocusIri = new Map<string, string>()

  values.forEach((value, idx) => {
    const focusIri = `${FOCUS_IRI_PREFIX}${idx}`
    const focus = namedNode(focusIri)
    ds.add(quad(focus, rdfType, cls))
    ds.add(quad(focus, propNode, toLiteralOrIri(value)))
    valueToFocusIri.set(String(value), focusIri)
  })

  return { dataset: ds, valueToFocusIri }
}

/** Stable cache key for a (propertyIri, value, targetClass) triple. */
export function makeCacheKey(
  propertyIri: string,
  value: string | number | boolean,
  targetClass?: string
): string {
  // `\0` separators keep the three fields unambiguous (no value can contain a
  // NUL), so distinct (property, value, target) triples can't collide on the key.
  return `${propertyIri}\0${typeof value}:${String(value)}\0${targetClass ?? ''}`
}

function toLiteralOrIri(value: string | number | boolean): NamedNode | ReturnType<typeof literal> {
  if (typeof value === 'number') {
    const isInt = Number.isInteger(value)
    return literal(String(value), namedNode(isInt ? iri('xsd', 'integer') : iri('xsd', 'decimal')))
  }
  if (typeof value === 'boolean') {
    return literal(String(value), namedNode(iri('xsd', 'boolean')))
  }
  // Strings that look like absolute IRIs become NamedNodes so sh:class /
  // sh:nodeKind constraints can evaluate correctly. Everything else is a
  // plain string literal.
  if (/^https?:\/\//.test(value) || /^urn:/.test(value)) {
    return namedNode(value)
  }
  return literal(value)
}

// ─── Internal: ValidationResult → ShaclViolation ─────────────────────────────

interface ValidatorResult {
  message: Term[]
  path: Term
  sourceConstraintComponent: Term
  value: Term
}

export function toViolation(result: ValidatorResult): ShaclViolation {
  const messages = result.message.map((m) => m.value).filter(Boolean)
  const constraint = result.sourceConstraintComponent.value
  const fallback = constraint.startsWith(SH_NS) ? constraint.substring(SH_NS.length) : constraint

  return {
    message: messages.length > 0 ? messages.join('; ') : `Failed ${fallback}`,
    sourceConstraintComponent: constraint,
    path: result.path?.termType === 'NamedNode' ? result.path.value : undefined,
    value: result.value?.value,
  }
}
