/**
 * GraphQL Validator — post-serialize syntactic + structural gate.
 *
 * Parses every serialized query with `graphql-js` (the canonical
 * reference implementation maintained by the GraphQL Foundation) and
 * walks the AST to catch structural issues:
 *
 *   - Syntax errors (invalid GraphQL per spec §2 Language)
 *   - Empty selection sets (spec §2.4 requires ≥1 field selection)
 *   - Missing field names (spec §2.5 Field definition)
 *
 * Mirrors the SPARQL validator (`sparql-validator.ts`) which uses
 * `sparqljs` for the same purpose against W3C SPARQL 1.1.
 *
 * @see https://spec.graphql.org/September2025/ — GraphQL Language Specification
 * @see https://spec.graphql.org/September2025/#sec-Language — §2 Language (syntax)
 * @see https://spec.graphql.org/September2025/#sec-Selection-Sets — §2.4 Selection Sets
 * @see https://github.com/graphql/graphql-js — reference implementation (parse gate)
 */

import {
  type DocumentNode,
  type FieldNode,
  Kind,
  parse,
  type SelectionSetNode,
  visit,
} from 'graphql'

import type { SearchSlots } from './slots.js'

export interface GraphQLValidationIssue {
  severity: 'error' | 'warning'
  message: string
}

export interface GraphQLValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  issues: GraphQLValidationIssue[]
}

/**
 * Validate a GraphQL query string against the spec.
 *
 * 1. Parse with `graphql-js` (catches all syntax errors)
 * 2. Walk the AST for structural warnings
 */
export function validateGraphQL(query: string): GraphQLValidationResult {
  const issues: GraphQLValidationIssue[] = []

  if (!query.trim()) {
    issues.push({ severity: 'error', message: 'Query is empty.' })
    return buildResult(issues)
  }

  let doc: DocumentNode
  try {
    doc = parse(query)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    issues.push({ severity: 'error', message: `GraphQL parse error: ${message}` })
    return buildResult(issues)
  }

  // Walk AST for structural issues
  validateDocument(doc, issues)

  return buildResult(issues)
}

/**
 * Verify that a GraphQL query string is structurally complete relative
 * to the SearchSlots it was generated from.
 *
 * Catches drift where the serializer omits a filter or range that
 * exists in the slots — the exact bug class the customer surfaced.
 */
export function validateGraphQLCompleteness(
  query: string,
  slots: SearchSlots
): GraphQLValidationResult {
  const issues: GraphQLValidationIssue[] = []

  // First, syntax validation
  const syntaxResult = validateGraphQL(query)
  issues.push(...syntaxResult.issues)
  if (!syntaxResult.valid) return buildResult(issues)

  // Extract field names from the GraphQL AST
  const doc = parse(query)
  const fieldNames = new Set<string>()
  visit(doc, {
    Field(node: FieldNode) {
      fieldNames.add(node.name.value)
    },
  })

  // Check that every filter key appears as a field
  for (const key of Object.keys(slots.filters)) {
    const safeKey = sanitizeForComparison(key)
    if (!fieldNames.has(safeKey)) {
      issues.push({
        severity: 'error',
        message: `Filter "${key}" missing from GraphQL output (expected field "${safeKey}")`,
      })
    }
  }

  // Check that every range key appears as a field
  for (const key of Object.keys(slots.ranges)) {
    const safeKey = sanitizeForComparison(key)
    if (!fieldNames.has(safeKey)) {
      issues.push({
        severity: 'error',
        message: `Range "${key}" missing from GraphQL output (expected field "${safeKey}")`,
      })
    }
  }

  // Check that every domain appears as a field
  for (const domain of slots.domains) {
    const safeDomain = sanitizeForComparison(domain)
    if (!fieldNames.has(safeDomain)) {
      issues.push({
        severity: 'error',
        message: `Domain "${domain}" missing from GraphQL output (expected field "${safeDomain}")`,
      })
    }
  }

  return buildResult(issues)
}

// ─── AST walkers ─────────────────────────────────────────────────────────────

function validateDocument(doc: DocumentNode, issues: GraphQLValidationIssue[]): void {
  if (doc.definitions.length === 0) {
    issues.push({ severity: 'error', message: 'Document contains no definitions.' })
    return
  }

  for (const def of doc.definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      if (def.selectionSet.selections.length === 0) {
        issues.push({ severity: 'warning', message: 'Query has an empty selection set.' })
      }
      validateSelectionSet(def.selectionSet, issues, 'query')
    }
  }
}

function validateSelectionSet(
  selectionSet: SelectionSetNode,
  issues: GraphQLValidationIssue[],
  parentPath: string
): void {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const fieldPath = `${parentPath}.${selection.name.value}`
      if (selection.selectionSet) {
        if (selection.selectionSet.selections.length === 0) {
          issues.push({
            severity: 'warning',
            message: `Empty selection set at "${fieldPath}".`,
          })
        }
        validateSelectionSet(selection.selectionSet, issues, fieldPath)
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mirror the serializer's field-name sanitization so comparisons match.
 * Must stay in sync with `sanitizeFieldName` in `graphql-serializer.ts`.
 */
function sanitizeForComparison(name: string): string {
  let safe = name.replace(/[^A-Za-z0-9_]/g, '_')
  if (/^[0-9]/.test(safe)) {
    safe = `_${safe}`
  }
  if (safe.length === 0) {
    safe = '_field'
  }
  return safe
}

function buildResult(issues: GraphQLValidationIssue[]): GraphQLValidationResult {
  const errors = issues.filter((i) => i.severity === 'error').map((i) => i.message)
  const warnings = issues.filter((i) => i.severity === 'warning').map((i) => i.message)
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues,
  }
}
