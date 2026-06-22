/**
 * SPARQL-validator context builders (ADR 0003) — walks a parsed query to
 * collect the QueryContext (defined vars, IRI-like vars) the validators read.
 * Depends only on the guards leaf.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { type Pattern, type Query, type Term, type VariableTerm } from 'sparqljs'

import {
  getProjectedVariables,
  isIriLikeExpression,
  isSelectQueryPattern,
  isVariableTerm,
  type QueryContext,
  stripVariableMarker,
} from './sparql-validator-guards.js'

export function collectQueryContext(query: Query): QueryContext {
  const definedVariables = new Set<string>()
  const iriLikeVariables = new Set<string>()

  collectValuesVariables(query.values, definedVariables)

  for (const pattern of query.where ?? []) {
    collectPatternDefinitions(pattern, definedVariables, iriLikeVariables)
  }

  return { definedVariables, iriLikeVariables }
}

export function collectPatternDefinitions(
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

export function buildLocalPatternContext(pattern: Pattern, parent: QueryContext): QueryContext {
  const definedVariables = new Set(parent.definedVariables)
  const iriLikeVariables = new Set(parent.iriLikeVariables)
  collectPatternDefinitions(pattern, definedVariables, iriLikeVariables)
  return { definedVariables, iriLikeVariables }
}

export function collectValuesVariables(
  values: Array<Record<string, Term | undefined>> | undefined,
  definedVariables: Set<string>
): void {
  for (const row of values ?? []) {
    for (const variableName of Object.keys(row)) {
      definedVariables.add(stripVariableMarker(variableName))
    }
  }
}

export function collectTermDefinition(
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

export function collectPredicateDefinition(
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
