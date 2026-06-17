/**
 * GraphQL Parser — GraphQL query string → SearchSlots.
 *
 * Reverses the serializer: parses the structured GraphQL query format
 * back into SearchSlots so that user edits in the GraphQL editor can
 * drive a new SPARQL compilation + execution round-trip.
 *
 * Uses `graphql-js` `parse()` (the reference implementation's parser,
 * which implements the full §2 Language grammar) for robust AST traversal
 * rather than fragile regex.
 *
 * ## AST mapping (GraphQL → SearchSlots)
 *
 * | GraphQL AST node            | Slot concept    | Spec section |
 * |-----------------------------|-----------------|--------------|
 * | OperationDefinition (query) | query root      | §2.3         |
 * | Top-level Field             | domain          | §2.5         |
 * | Nested Field                | filter/range    | §2.5         |
 * | Argument (values: [...])    | filter values   | §2.6         |
 * | Argument (min/max: N)       | range bounds    | §2.6         |
 * | Argument (references: [...]) | references     | §2.6         |
 * | ObjectValue                 | reference entry / ref filters / ref ranges | §2.9.8 |
 * | ListValue                   | array values    | §2.9.7       |
 * | StringValue                 | literal value   | §2.9.4       |
 * | IntValue / FloatValue       | numeric bounds  | §2.9.1–2.9.2 |
 *
 * @see https://spec.graphql.org/September2025/ — GraphQL Language Specification
 * @see slotsToGraphQL in ./graphql-serializer.ts — the forward path
 * @see https://github.com/graphql/graphql-js — reference implementation (parser)
 */

import { type ObjectValueNode, parse } from 'graphql'

import type { ReferenceFilter, SearchSlots } from './slots.js'

export interface GraphQLParseResult {
  success: true
  slots: SearchSlots
}

export interface GraphQLParseError {
  success: false
  error: string
}

/**
 * Parse a GraphQL query string (in our structured format) into SearchSlots.
 *
 * Expected shape:
 * ```graphql
 * query {
 *   domainName {
 *     filterField(values: ["a", "b"])
 *     rangeField(min: 1, max: 10)
 *   }
 * }
 * ```
 */
export function parseGraphQLToSlots(query: string): GraphQLParseResult | GraphQLParseError {
  let ast
  try {
    ast = parse(query)
  } catch (err) {
    return {
      success: false,
      error: `Syntax error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Expect exactly one OperationDefinition of type 'query'
  const opDef = ast.definitions.find((d) => d.kind === 'OperationDefinition')
  if (!opDef || opDef.kind !== 'OperationDefinition') {
    return { success: false, error: 'No query operation found' }
  }

  const domains: string[] = []
  const filters: Record<string, string | string[]> = {}
  const ranges: Record<string, { min?: number; max?: number }> = {}
  const references: ReferenceFilter[] = []

  // Each top-level field in the query = a domain
  for (const selection of opDef.selectionSet.selections) {
    if (selection.kind !== 'Field') continue

    const domainName = selection.name.value

    // Skip placeholder fields
    if (domainName === '_empty') continue

    domains.push(domainName)

    // The `references:` argument on the domain field carries cross-domain joins
    // (each entry may carry its own reference-scoped filters/ranges).
    for (const arg of selection.arguments ?? []) {
      if (arg.name.value === 'references' && arg.value.kind === 'ListValue') {
        for (const item of arg.value.values) {
          if (item.kind === 'ObjectValue') {
            const ref = parseReferenceObject(item)
            if (ref) references.push(ref)
          }
        }
      }
    }

    // Process fields within the domain's selection set
    if (!selection.selectionSet) continue

    for (const field of selection.selectionSet.selections) {
      if (field.kind !== 'Field') continue

      const fieldName = field.name.value

      // Skip placeholder fields
      if (fieldName === '_all') continue

      // Check arguments for values/min/max
      if (!field.arguments || field.arguments.length === 0) continue

      for (const arg of field.arguments) {
        if (arg.name.value === 'values' && arg.value.kind === 'ListValue') {
          // Filter: values: ["a", "b"]
          const values = arg.value.values
            .filter((v) => v.kind === 'StringValue')
            .map((v) => {
              if (v.kind === 'StringValue') return v.value
              return ''
            })
            .filter((v) => v.length > 0)

          if (values.length === 1) {
            filters[fieldName] = values[0]!
          } else if (values.length > 1) {
            filters[fieldName] = values
          }
        } else if (arg.name.value === 'min' || arg.name.value === 'max') {
          // Range: min/max
          if (!ranges[fieldName]) {
            ranges[fieldName] = {}
          }
          const numValue =
            arg.value.kind === 'IntValue'
              ? parseInt(arg.value.value, 10)
              : arg.value.kind === 'FloatValue'
                ? parseFloat(arg.value.value)
                : undefined
          if (numValue !== undefined) {
            ranges[fieldName]![arg.name.value] = numValue
          }
        }
      }
    }
  }

  const slots: SearchSlots = { domains, filters, ranges }
  if (references.length > 0) slots.references = references
  return { success: true, slots }
}

/**
 * Parse a `{ domain, label?, filters?, ranges?, references? }` object value into
 * a {@link ReferenceFilter}. Recurses into nested references. Returns null when
 * no `domain` is present.
 */
function parseReferenceObject(obj: ObjectValueNode): ReferenceFilter | null {
  let domain: string | undefined
  let label: string | undefined
  let filters: Record<string, string | string[]> | undefined
  let ranges: Record<string, { min?: number; max?: number }> | undefined
  let nested: ReferenceFilter[] | undefined

  for (const field of obj.fields) {
    const name = field.name.value
    const value = field.value
    if (name === 'domain' && value.kind === 'StringValue') {
      domain = value.value
    } else if (name === 'label' && value.kind === 'StringValue') {
      label = value.value
    } else if (name === 'filters' && value.kind === 'ObjectValue') {
      filters = parseRefFilters(value)
    } else if (name === 'ranges' && value.kind === 'ObjectValue') {
      ranges = parseRefRanges(value)
    } else if (name === 'references' && value.kind === 'ListValue') {
      const arr: ReferenceFilter[] = []
      for (const item of value.values) {
        if (item.kind === 'ObjectValue') {
          const ref = parseReferenceObject(item)
          if (ref) arr.push(ref)
        }
      }
      if (arr.length > 0) nested = arr
    }
  }

  if (!domain) return null
  const ref: ReferenceFilter = { domain }
  if (label) ref.label = label
  if (filters && Object.keys(filters).length > 0) ref.filters = filters
  if (ranges && Object.keys(ranges).length > 0) ref.ranges = ranges
  if (nested && nested.length > 0) ref.references = nested
  return ref
}

/** Parse a `{ key: ["v1", "v2"], … }` object value into a filters record. */
function parseRefFilters(obj: ObjectValueNode): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const field of obj.fields) {
    const key = field.name.value
    const value = field.value
    if (value.kind === 'ListValue') {
      const values = value.values
        .filter((v) => v.kind === 'StringValue')
        .map((v) => (v.kind === 'StringValue' ? v.value : ''))
        .filter((v) => v.length > 0)
      if (values.length === 1) out[key] = values[0]!
      else if (values.length > 1) out[key] = values
    } else if (value.kind === 'StringValue' && value.value.length > 0) {
      out[key] = value.value
    }
  }
  return out
}

/** Parse a `{ key: { min: 1, max: 4 }, … }` object value into a ranges record. */
function parseRefRanges(obj: ObjectValueNode): Record<string, { min?: number; max?: number }> {
  const out: Record<string, { min?: number; max?: number }> = {}
  for (const field of obj.fields) {
    const key = field.name.value
    if (field.value.kind !== 'ObjectValue') continue
    const bound: { min?: number; max?: number } = {}
    for (const b of field.value.fields) {
      if (b.name.value !== 'min' && b.name.value !== 'max') continue
      const n =
        b.value.kind === 'IntValue'
          ? parseInt(b.value.value, 10)
          : b.value.kind === 'FloatValue'
            ? parseFloat(b.value.value)
            : undefined
      if (n !== undefined) bound[b.name.value] = n
    }
    if (bound.min !== undefined || bound.max !== undefined) out[key] = bound
  }
  return out
}
