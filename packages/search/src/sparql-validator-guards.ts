/**
 * SPARQL-validator guards & predicates (ADR 0003) — the leaf layer of the
 * validator: sparqljs AST type-guards, the operator-arity/string-operator
 * tables, and the pure analysis predicates (IRI/literal-mismatch heuristics,
 * expression formatting). No sibling imports — the validator DAG's sink.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { iri } from '@ontology-search/core/rdf/prefixes'
import {
  type AggregateExpression,
  type Expression,
  type FunctionCallExpression,
  type LiteralTerm,
  type OperationExpression,
  type Pattern,
  type Query,
  type SelectQuery,
  type Term,
  type VariableTerm,
  Wildcard,
} from 'sparqljs'

export interface QueryContext {
  definedVariables: Set<string>
  iriLikeVariables: Set<string>
}

export const FIXED_ARITY = new Map<string, number[]>([
  ['bound', [1]],
  ['str', [1]],
  ['lang', [1]],
  ['langmatches', [2]],
  ['datatype', [1]],
  ['iri', [1]],
  ['uri', [1]],
  ['bnode', [0, 1]],
  ['strdt', [2]],
  ['strlang', [2]],
  ['uuid', [0]],
  ['struuid', [0]],
  ['strlen', [1]],
  ['substr', [2, 3]],
  ['ucase', [1]],
  ['lcase', [1]],
  ['strstarts', [2]],
  ['strends', [2]],
  ['contains', [2]],
  ['strbefore', [2]],
  ['strafter', [2]],
  ['encode_for_uri', [1]],
  ['regex', [2, 3]],
  ['replace', [3, 4]],
  ['abs', [1]],
  ['round', [1]],
  ['ceil', [1]],
  ['floor', [1]],
  ['rand', [0]],
  ['now', [0]],
  ['year', [1]],
  ['month', [1]],
  ['day', [1]],
  ['hours', [1]],
  ['minutes', [1]],
  ['seconds', [1]],
  ['timezone', [1]],
  ['tz', [1]],
  ['md5', [1]],
  ['sha1', [1]],
  ['sha256', [1]],
  ['sha384', [1]],
  ['sha512', [1]],
  ['isiri', [1]],
  ['isuri', [1]],
  ['isblank', [1]],
  ['isliteral', [1]],
  ['isnumeric', [1]],
  ['sameterm', [2]],
  ['if', [3]],
])

export const MIN_ARITY = new Map<string, number>([
  ['concat', 1],
  ['coalesce', 1],
])

export const STRING_OPERATORS = new Set([
  'contains',
  'strstarts',
  'strends',
  'regex',
  'lcase',
  'ucase',
  'strlen',
  'substr',
  'replace',
  'strbefore',
  'strafter',
  'encode_for_uri',
])

export const COMPARISON_OPERATORS = new Set(['=', '!=', 'in', 'notin'])

export function getProjectedVariables(query: SelectQuery): string[] {
  if (query.variables.length === 1 && isWildcardValue(query.variables[0])) {
    return []
  }

  return query.variables.flatMap((variable) => {
    if (isVariableTerm(variable)) {
      return [variable.value]
    }

    if (isVariableExpression(variable)) {
      return [variable.variable.value]
    }

    return []
  })
}

export function getComparisonPairs(
  expression: OperationExpression
): Array<[Expression, Expression]> {
  if (
    (expression.operator === 'in' || expression.operator === 'notin') &&
    expression.args[1] &&
    Array.isArray(expression.args[1])
  ) {
    return expression.args[1].map((candidate) => [expression.args[0] as Expression, candidate])
  }

  if (
    expression.args[0] &&
    expression.args[1] &&
    !Array.isArray(expression.args[0]) &&
    !isPatternArgument(expression.args[0]) &&
    !isPatternArgument(expression.args[1])
  ) {
    return [[expression.args[0] as Expression, expression.args[1] as Expression]]
  }

  return []
}

export function isPotentialIriLiteralMismatch(
  left: Expression,
  right: Expression,
  context: QueryContext
): boolean {
  if (!isStringLiteral(right)) {
    return false
  }

  if (hasStrNormalization(left)) {
    return false
  }

  if (isNamedNodeTerm(left) || isIriLikeExpression(left)) {
    return true
  }

  return isVariableTerm(left) && context.iriLikeVariables.has(left.value)
}

export function shouldWarnAboutRawStringTerm(expression: Expression): boolean {
  if (hasStrNormalization(expression)) {
    return false
  }

  return isVariableTerm(expression) || isNamedNodeTerm(expression)
}

export function isIriLikeExpression(expression: Expression): boolean {
  if (isNamedNodeTerm(expression)) {
    return true
  }

  return (
    isOperationExpression(expression) && ['iri', 'uri'].includes(expression.operator.toLowerCase())
  )
}

export function hasStrNormalization(expression: Expression): boolean {
  if (isOperationExpression(expression) && expression.operator.toLowerCase() === 'str') {
    return true
  }

  if (isFunctionCallExpression(expression)) {
    return expression.function === 'STR'
  }

  if (isOperationExpression(expression)) {
    return expression.args.some((arg) => !isPatternArgument(arg) && hasStrNormalization(arg))
  }

  if (isAggregateExpression(expression) && !isWildcardValue(expression.expression)) {
    return hasStrNormalization(expression.expression)
  }

  if (Array.isArray(expression)) {
    return expression.some((item) => hasStrNormalization(item))
  }

  return false
}

export function isWildcardValue(value: unknown): value is Wildcard {
  return value instanceof Wildcard || isObjectWith(value, 'termType', 'Wildcard')
}

export function isVariableExpression(
  value: unknown
): value is { expression: Expression; variable: VariableTerm } {
  return (
    Boolean(value && typeof value === 'object' && 'expression' in value && 'variable' in value) &&
    isVariableTerm((value as { variable: unknown }).variable)
  )
}

export function isVariableTerm(value: unknown): value is VariableTerm {
  return (
    isObjectWith(value, 'termType', 'Variable') && typeof (value as VariableTerm).value === 'string'
  )
}

export function isNamedNodeTerm(value: unknown): value is Term {
  return isObjectWith(value, 'termType', 'NamedNode')
}

export function isLiteralTerm(value: unknown): value is LiteralTerm {
  return (
    isObjectWith(value, 'termType', 'Literal') && typeof (value as LiteralTerm).value === 'string'
  )
}

export function isOperationExpression(value: unknown): value is OperationExpression {
  return isObjectWith(value, 'type', 'operation')
}

export function isFunctionCallExpression(value: unknown): value is FunctionCallExpression {
  return isObjectWith(value, 'type', 'functionCall')
}

export function isAggregateExpression(value: unknown): value is AggregateExpression {
  return isObjectWith(value, 'type', 'aggregate')
}

export function isSelectQueryPattern(value: unknown): value is SelectQuery {
  return isObjectWith(value, 'type', 'query') && (value as SelectQuery).queryType === 'SELECT'
}

export function isPatternArgument(value: unknown): value is Pattern {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'type' in value &&
    [
      'bgp',
      'optional',
      'union',
      'group',
      'graph',
      'minus',
      'service',
      'filter',
      'bind',
      'values',
      'query',
    ].includes(String((value as Pattern | Query).type))
  )
}

export function isStringLiteral(value: unknown): value is LiteralTerm {
  if (!isLiteralTerm(value)) {
    return false
  }

  return value.language.length > 0 || value.datatype?.value === iri('xsd', 'string')
}

export function formatExpectedArity(expected: number[]): string {
  return expected.length === 1 ? `${expected[0]}` : expected.join(' or ')
}

export function formatExpression(expression: Expression): string {
  if (isVariableTerm(expression)) {
    return `?${expression.value}`
  }

  if (isNamedNodeTerm(expression)) {
    return `<${expression.value}>`
  }

  if (isLiteralTerm(expression)) {
    return JSON.stringify(expression.value)
  }

  if (isOperationExpression(expression)) {
    return `${expression.operator}(...)`
  }

  if (isFunctionCallExpression(expression)) {
    return `${expression.function}(...)`
  }

  return 'expression'
}

export function stripVariableMarker(variableName: string): string {
  return variableName.startsWith('?') || variableName.startsWith('$')
    ? variableName.slice(1)
    : variableName
}

export function isObjectWith<T extends string>(value: unknown, key: string, expected: T): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    key in value &&
    (value as Record<string, unknown>)[key] === expected
  )
}
