import {
  type AggregateExpression,
  type Expression,
  type FunctionCallExpression,
  type LiteralTerm,
  type OperationExpression,
  type Ordering,
  Parser,
  type Pattern,
  type Query,
  type SelectQuery,
  type SparqlQuery,
  type Term,
  type VariableTerm,
  Wildcard,
} from 'sparqljs'

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

interface QueryContext {
  definedVariables: Set<string>
  iriLikeVariables: Set<string>
}

const parser = new Parser()

const FIXED_ARITY = new Map<string, number[]>([
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

const MIN_ARITY = new Map<string, number>([
  ['concat', 1],
  ['coalesce', 1],
])

const STRING_OPERATORS = new Set([
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

const COMPARISON_OPERATORS = new Set(['=', '!=', 'in', 'notin'])

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

function collectQueryContext(query: Query): QueryContext {
  const definedVariables = new Set<string>()
  const iriLikeVariables = new Set<string>()

  collectValuesVariables(query.values, definedVariables)

  for (const pattern of query.where ?? []) {
    collectPatternDefinitions(pattern, definedVariables, iriLikeVariables)
  }

  return { definedVariables, iriLikeVariables }
}

function collectPatternDefinitions(
  pattern: Pattern,
  definedVariables: Set<string>,
  iriLikeVariables: Set<string>
): void {
  if (isSelectQueryPattern(pattern)) {
    for (const projected of getProjectedVariables(pattern)) {
      definedVariables.add(projected)
    }
    return
  }

  switch (pattern.type) {
    case 'bgp':
      for (const triple of pattern.triples) {
        collectTermDefinition(triple.subject, definedVariables, iriLikeVariables, true)
        collectPredicateDefinition(triple.predicate, definedVariables, iriLikeVariables)
        collectTermDefinition(triple.object, definedVariables, iriLikeVariables, false)
      }
      return
    case 'bind':
      definedVariables.add(pattern.variable.value)
      if (isIriLikeExpression(pattern.expression)) {
        iriLikeVariables.add(pattern.variable.value)
      }
      return
    case 'values':
      collectValuesVariables(pattern.values, definedVariables)
      return
    case 'graph':
      if ('name' in pattern) {
        collectTermDefinition(pattern.name, definedVariables, iriLikeVariables, true)
      }
      for (const child of pattern.patterns ?? []) {
        collectPatternDefinitions(child, definedVariables, iriLikeVariables)
      }
      return
    case 'optional':
    case 'union':
    case 'group':
    case 'minus':
    case 'service':
      for (const child of pattern.patterns ?? []) {
        collectPatternDefinitions(child, definedVariables, iriLikeVariables)
      }
      return
    case 'filter':
      return
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

function buildLocalPatternContext(pattern: Pattern, parent: QueryContext): QueryContext {
  const definedVariables = new Set(parent.definedVariables)
  const iriLikeVariables = new Set(parent.iriLikeVariables)
  collectPatternDefinitions(pattern, definedVariables, iriLikeVariables)
  return { definedVariables, iriLikeVariables }
}

function collectValuesVariables(
  values: Array<Record<string, Term | undefined>> | undefined,
  definedVariables: Set<string>
): void {
  for (const row of values ?? []) {
    for (const variableName of Object.keys(row)) {
      definedVariables.add(stripVariableMarker(variableName))
    }
  }
}

function collectTermDefinition(
  term: Term | VariableTerm,
  definedVariables: Set<string>,
  iriLikeVariables: Set<string>,
  markAsIriLike: boolean
): void {
  if (!isVariableTerm(term)) {
    return
  }

  definedVariables.add(term.value)
  if (markAsIriLike) {
    iriLikeVariables.add(term.value)
  }
}

function collectPredicateDefinition(
  predicate: Term | VariableTerm | { items?: Array<Term | { items?: unknown[] }> },
  definedVariables: Set<string>,
  iriLikeVariables: Set<string>
): void {
  if (isVariableTerm(predicate)) {
    definedVariables.add(predicate.value)
    iriLikeVariables.add(predicate.value)
    return
  }

  if (!predicate || typeof predicate !== 'object' || !('items' in predicate)) {
    return
  }

  for (const item of predicate.items ?? []) {
    if (isVariableTerm(item)) {
      definedVariables.add(item.value)
      iriLikeVariables.add(item.value)
      continue
    }

    if (item && typeof item === 'object' && 'items' in item) {
      collectPredicateDefinition(
        item as { items?: Array<Term | { items?: unknown[] }> },
        definedVariables,
        iriLikeVariables
      )
    }
  }
}

function getProjectedVariables(query: SelectQuery): string[] {
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

function getComparisonPairs(expression: OperationExpression): Array<[Expression, Expression]> {
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

function isPotentialIriLiteralMismatch(
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

function shouldWarnAboutRawStringTerm(expression: Expression): boolean {
  if (hasStrNormalization(expression)) {
    return false
  }

  return isVariableTerm(expression) || isNamedNodeTerm(expression)
}

function isIriLikeExpression(expression: Expression): boolean {
  if (isNamedNodeTerm(expression)) {
    return true
  }

  return (
    isOperationExpression(expression) && ['iri', 'uri'].includes(expression.operator.toLowerCase())
  )
}

function hasStrNormalization(expression: Expression): boolean {
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

function isWildcardValue(value: unknown): value is Wildcard {
  return value instanceof Wildcard || isObjectWith(value, 'termType', 'Wildcard')
}

function isVariableExpression(
  value: unknown
): value is { expression: Expression; variable: VariableTerm } {
  return (
    Boolean(value && typeof value === 'object' && 'expression' in value && 'variable' in value) &&
    isVariableTerm((value as { variable: unknown }).variable)
  )
}

function isVariableTerm(value: unknown): value is VariableTerm {
  return (
    isObjectWith(value, 'termType', 'Variable') && typeof (value as VariableTerm).value === 'string'
  )
}

function isNamedNodeTerm(value: unknown): value is Term {
  return isObjectWith(value, 'termType', 'NamedNode')
}

function isLiteralTerm(value: unknown): value is LiteralTerm {
  return (
    isObjectWith(value, 'termType', 'Literal') && typeof (value as LiteralTerm).value === 'string'
  )
}

function isOperationExpression(value: unknown): value is OperationExpression {
  return isObjectWith(value, 'type', 'operation')
}

function isFunctionCallExpression(value: unknown): value is FunctionCallExpression {
  return isObjectWith(value, 'type', 'functionCall')
}

function isAggregateExpression(value: unknown): value is AggregateExpression {
  return isObjectWith(value, 'type', 'aggregate')
}

function isSelectQueryPattern(value: unknown): value is SelectQuery {
  return isObjectWith(value, 'type', 'query') && (value as SelectQuery).queryType === 'SELECT'
}

function isPatternArgument(value: unknown): value is Pattern {
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

function isStringLiteral(value: unknown): value is LiteralTerm {
  if (!isLiteralTerm(value)) {
    return false
  }

  return (
    value.language.length > 0 || value.datatype?.value === 'http://www.w3.org/2001/XMLSchema#string'
  )
}

function formatExpectedArity(expected: number[]): string {
  return expected.length === 1 ? `${expected[0]}` : expected.join(' or ')
}

function formatExpression(expression: Expression): string {
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

function stripVariableMarker(variableName: string): string {
  return variableName.startsWith('?') || variableName.startsWith('$')
    ? variableName.slice(1)
    : variableName
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

function isObjectWith<T extends string>(value: unknown, key: string, expected: T): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    key in value &&
    (value as Record<string, unknown>)[key] === expected
  )
}
