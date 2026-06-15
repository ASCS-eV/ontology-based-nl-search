/**
 * GraphQL Parser — GraphQL query string → SearchSlots.
 *
 * Reverses the serializer: parses the structured GraphQL query format
 * back into SearchSlots so that user edits in the GraphQL editor can
 * drive a new SPARQL compilation + execution round-trip.
 *
 * Uses `graphql-js` parse for robust AST traversal rather than regex.
 *
 * @see slotsToGraphQL in ./graphql-serializer.ts — the forward path
 */

import { parse } from 'graphql'

import type { SearchSlots } from './slots.js'

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

  // Each top-level field in the query = a domain
  for (const selection of opDef.selectionSet.selections) {
    if (selection.kind !== 'Field') continue

    const domainName = selection.name.value

    // Skip placeholder fields
    if (domainName === '_empty') continue

    domains.push(domainName)

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

  return {
    success: true,
    slots: { domains, filters, ranges },
  }
}
