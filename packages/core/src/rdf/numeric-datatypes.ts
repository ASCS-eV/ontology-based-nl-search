/**
 * Numeric XSD datatypes — the single classification every consumer uses to
 * decide whether a `sh:datatype` makes a property range-filterable.
 *
 * [RDF11] §5.1 lists the RDF-compatible XSD numeric types: the core types
 * `xsd:decimal` and `xsd:integer`, the IEEE floating-point numbers
 * `xsd:double` and `xsd:float`, and the limited-range integer numbers. Every
 * one has a numeric value space, so all of them take `min`/`max` bounds; only
 * the integer family is restricted to whole numbers.
 */
import { RDF_PREFIXES } from './prefixes.js'

/** Whether a numeric datatype holds whole numbers only or any number. */
export type NumericKind = 'integer' | 'float'

const XSD = RDF_PREFIXES.xsd

// [RDF11] §5.1 "Core types" (integer) and "Limited-range integer numbers".
const INTEGER_TYPES = [
  'integer',
  'long',
  'int',
  'short',
  'byte',
  'unsignedLong',
  'unsignedInt',
  'unsignedShort',
  'unsignedByte',
  'positiveInteger',
  'nonNegativeInteger',
  'negativeInteger',
  'nonPositiveInteger',
]

// [RDF11] §5.1 "Core types" (decimal) and "IEEE floating-point numbers".
const NON_INTEGER_TYPES = ['decimal', 'double', 'float']

const KIND_BY_IRI: ReadonlyMap<string, NumericKind> = new Map([
  ...INTEGER_TYPES.map((t): [string, NumericKind] => [`${XSD}${t}`, 'integer']),
  ...NON_INTEGER_TYPES.map((t): [string, NumericKind] => [`${XSD}${t}`, 'float']),
])

/** Full IRIs of every numeric XSD datatype, sorted for deterministic emission. */
export const NUMERIC_DATATYPE_IRIS: readonly string[] = [...KIND_BY_IRI.keys()].sort()

/** The numeric kind of a datatype IRI, or `null` when it is not numeric. */
export function numericKind(datatype: string | undefined): NumericKind | null {
  return datatype === undefined ? null : (KIND_BY_IRI.get(datatype) ?? null)
}
