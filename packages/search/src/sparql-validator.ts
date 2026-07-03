/**
 * SPARQL Validator — post-compilation syntax + W3C-compliance checks.
 *
 * Parses the generated query with sparqljs and walks the AST to flag errors
 * (operator arity, projection scope) and warnings (likely IRI/literal
 * mismatches). The walkers live here; the AST type-guards + analysis predicates
 * are in `./sparql-validator-guards.js` (leaf) and the QueryContext builders in
 * `./sparql-validator-context.js` (ADR 0003 split for CONTRIBUTING #15). Public
 * surface (validateSparql + the two result interfaces) is unchanged.
 *
 * STANDARDS — validates against:
 *   [SPARQL11] SPARQL 1.1 Query Language — docs/specs/references/sparql11-query.md
 *              https://www.w3.org/TR/sparql11-query/
 */
import {
  type Expression,
  type OperationExpression,
  type Ordering,
  Parser,
  type Pattern,
  type Query,
  type SelectQuery,
  type SparqlQuery,
} from 'sparqljs'

import { buildLocalPatternContext, collectQueryContext } from './sparql-validator-context.js'
import {
  COMPARISON_OPERATORS,
  FIXED_ARITY,
  formatExpectedArity,
  formatExpression,
  getComparisonPairs,
  isAggregateExpression,
  isFunctionCallExpression,
  isOperationExpression,
  isPatternArgument,
  isPotentialIriLiteralMismatch,
  isSelectQueryPattern,
  isStringLiteral,
  isVariableExpression,
  isVariableTerm,
  isWildcardValue,
  MIN_ARITY,
  type QueryContext,
  shouldWarnAboutRawStringTerm,
  STRING_OPERATORS,
} from './sparql-validator-guards.js'

export interface SparqlValidationIssue {
  severity: 'error' | 'warning'
  message: string
}

export interface SparqlValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  issues: SparqlValidationIssue[]
}

const parser = new Parser()

export function validateSparql(query: string): SparqlValidationResult {
  const issues: SparqlValidationIssue[] = []

  if (!query.trim()) {
    issues.push({ severity: 'error', message: 'Query is empty.' })
    return buildResult(issues)
  }

  let parsed: SparqlQuery
  try {
    parsed = parser.parse(query)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    issues.push({ severity: 'error', message: `Parse error: ${message}` })
    return buildResult(issues)
  }

  if (parsed.type === 'query') {
    validateQuery(parsed, issues)
  }

  return buildResult(issues)
}

function validateQuery(query: Query, issues: SparqlValidationIssue[]): void {
  const context = collectQueryContext(query)

  if (query.where) {
    validatePatterns(query.where, context, issues)
  }

  if (query.queryType === 'SELECT') {
    validateSelectProjection(query, context, issues)
    for (const grouping of query.group ?? []) {
      validateExpression(grouping.expression, context, issues)
    }
    for (const having of query.having ?? []) {
      validateExpression(having, context, issues)
    }
    for (const ordering of query.order ?? []) {
      validateOrdering(ordering, context, issues)
    }
  }
}

function validatePatterns(
  patterns: Pattern[],
  context: QueryContext,
  issues: SparqlValidationIssue[]
): void {
  for (const pattern of patterns) {
    validatePattern(pattern, context, issues)
  }
}

function validatePattern(
  pattern: Pattern,
  context: QueryContext,
  issues: SparqlValidationIssue[]
): void {
  if (isSelectQueryPattern(pattern)) {
    validateQuery(pattern, issues)
    return
  }

  switch (pattern.type) {
    case 'filter':
      validateExpression(pattern.expression, context, issues)
      return
    case 'bind':
      validateExpression(pattern.expression, context, issues)
      return
    case 'optional':
    case 'union':
    case 'group':
    case 'minus':
    case 'graph':
    case 'service':
      validatePatterns(pattern.patterns ?? [], context, issues)
      return
    case 'bgp':
    case 'values':
      return
  }
}

function validateSelectProjection(
  query: SelectQuery,
  context: QueryContext,
  issues: SparqlValidationIssue[]
): void {
  if (query.variables.length === 1 && isWildcardValue(query.variables[0])) {
    return
  }

  for (const variable of query.variables) {
    if (isVariableTerm(variable)) {
      if (!context.definedVariables.has(variable.value)) {
        addIssue(issues, 'error', `Undefined projected variable ?${variable.value}.`)
      }
      continue
    }

    if (isVariableExpression(variable)) {
      validateExpression(variable.expression, context, issues)
    }
  }
}

function validateOrdering(
  ordering: Ordering,
  context: QueryContext,
  issues: SparqlValidationIssue[]
): void {
  validateExpression(ordering.expression, context, issues)
}

function validateExpression(
  expression: Expression,
  context: QueryContext,
  issues: SparqlValidationIssue[]
): void {
  if (Array.isArray(expression)) {
    for (const item of expression) {
      validateExpression(item, context, issues)
    }
    return
  }

  if (isVariableTerm(expression)) {
    if (!context.definedVariables.has(expression.value)) {
      addIssue(issues, 'error', `Undefined variable ?${expression.value}.`)
    }
    return
  }

  if (isAggregateExpression(expression)) {
    if (!isWildcardValue(expression.expression)) {
      validateExpression(expression.expression, context, issues)
    }
    return
  }

  if (isFunctionCallExpression(expression)) {
    for (const arg of expression.args) {
      validateExpression(arg, context, issues)
    }
    return
  }

  if (!isOperationExpression(expression)) {
    return
  }

  validateOperator(expression, context, issues)

  for (const arg of expression.args) {
    if (isPatternArgument(arg)) {
      const localContext = buildLocalPatternContext(arg, context)
      validatePattern(arg, localContext, issues)
      continue
    }

    validateExpression(arg, context, issues)
  }
}

function validateOperator(
  expression: OperationExpression,
  context: QueryContext,
  issues: SparqlValidationIssue[]
): void {
  const operator = expression.operator.toLowerCase()
  const argCount = expression.args.length
  const expected = FIXED_ARITY.get(operator)
  if (expected && !expected.includes(argCount)) {
    addIssue(
      issues,
      'error',
      `Operator ${expression.operator} expects ${formatExpectedArity(expected)} argument(s), got ${argCount}.`
    )
  }

  const minArity = MIN_ARITY.get(operator)
  if (minArity !== undefined && argCount < minArity) {
    addIssue(
      issues,
      'error',
      `Operator ${expression.operator} expects at least ${minArity} argument(s), got ${argCount}.`
    )
  }

  if (operator === 'bound' && expression.args[0] && !isVariableTerm(expression.args[0])) {
    addIssue(issues, 'error', 'BOUND must be called with a variable argument.')
  }

  if (operator === 'regex' && expression.args[2] && !isStringLiteral(expression.args[2])) {
    addIssue(issues, 'error', 'REGEX flags must be a string literal.')
  }

  if (
    STRING_OPERATORS.has(operator) &&
    expression.args[0] &&
    !isPatternArgument(expression.args[0]) &&
    shouldWarnAboutRawStringTerm(expression.args[0])
  ) {
    addIssue(
      issues,
      'warning',
      `${expression.operator} is applied to a raw RDF term; wrap it with STR(...) when the value may be an IRI.`
    )
  }

  if (COMPARISON_OPERATORS.has(operator)) {
    for (const [left, right] of getComparisonPairs(expression)) {
      if (isPotentialIriLiteralMismatch(left, right, context)) {
        addIssue(
          issues,
          'warning',
          `Possible IRI/literal mismatch in ${expression.operator}: compare ${formatExpression(left)} via STR(...) before using a string literal.`
        )
      }
      if (isPotentialIriLiteralMismatch(right, left, context)) {
        addIssue(
          issues,
          'warning',
          `Possible IRI/literal mismatch in ${expression.operator}: compare ${formatExpression(right)} via STR(...) before using a string literal.`
        )
      }
    }
  }
}

function addIssue(
  issues: SparqlValidationIssue[],
  severity: SparqlValidationIssue['severity'],
  message: string
): void {
  if (!issues.some((issue) => issue.severity === severity && issue.message === message)) {
    issues.push({ severity, message })
  }
}

function buildResult(issues: SparqlValidationIssue[]): SparqlValidationResult {
  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    errors: issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message),
    warnings: issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message),
    issues,
  }
}
