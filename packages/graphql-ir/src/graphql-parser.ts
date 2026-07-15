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
 * | Field `references`          | references container | §2.5    |
 * | Field under `references`    | reference entry | §2.5         |
 * | Argument (label: "...")     | reference label | §2.6         |
 * | ListValue                   | array values    | §2.9.7       |
 * | StringValue                 | literal value   | §2.9.4       |
 * | EnumValue                   | enum filter value | §2.9.6     |
 * | IntValue / FloatValue       | numeric bounds  | §2.9.1–2.9.2 |
 *
 * References are modelled as recursive *fields* (`references { <domain> { … } }`),
 * not an argument — parsing a referenced asset's selection set is the same
 * routine as parsing a domain's, applied recursively. See
 * `docs/adr/0002-field-based-recursive-references.md`.
 *
 * @see https://spec.graphql.org/September2025/ — GraphQL Language Specification
 * @see slotsToGraphQL in ./graphql-serializer.ts — the forward path
 * @see https://github.com/graphql/graphql-js — reference implementation (parser)
 */

import type { ReferenceFilter, SearchSlots } from '@ontology-search/slots/slots'
import { type FieldNode, parse, type SelectionSetNode } from 'graphql'

import type { GraphQLNameMap } from './graphql-name.js'

export interface GraphQLParseResult {
  success: true
  slots: SearchSlots
}

export interface GraphQLParseError {
  success: false
  error: string
}

export interface GraphQLParseOptions {
  /** Restore sanitized GraphQL names to their raw ontology names. */
  nameMap?: GraphQLNameMap
}

/** The constraints a selection set carries: property filters, ranges, references. */
interface ParsedSelection {
  filters: Record<string, string | string[]>
  ranges: Record<string, { min?: number; max?: number }>
  references: ReferenceFilter[]
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
 *     references {
 *       otherDomain(label: "x") { someField(values: ["v"]) }
 *     }
 *   }
 * }
 * ```
 */
export function parseGraphQLToSlots(
  query: string,
  options: GraphQLParseOptions = {}
): GraphQLParseResult | GraphQLParseError {
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

  // Each top-level field in the query = a domain. Its selection set carries the
  // same shape as a referenced asset's, so one routine parses both.
  for (const selection of opDef.selectionSet.selections) {
    if (selection.kind !== 'Field') continue

    const graphQLDomainName = selection.name.value
    if (graphQLDomainName === '_empty') continue // placeholder
    const domainName = options.nameMap?.domains.get(graphQLDomainName) ?? graphQLDomainName

    domains.push(domainName)

    if (!selection.selectionSet) continue
    const parsed = parseSelectionSet(selection.selectionSet, domainName, options.nameMap)
    // Top-level filters/ranges are flat in the slot model, so merge across
    // domains; references accumulate into the single top-level list.
    Object.assign(filters, parsed.filters)
    Object.assign(ranges, parsed.ranges)
    references.push(...parsed.references)
  }

  const slots: SearchSlots = { domains, filters, ranges }
  if (references.length > 0) slots.references = references
  return { success: true, slots }
}

/**
 * Parse a selection set into the constraints it expresses: property fields
 * become filters/ranges, and the reserved `references` field's sub-fields become
 * {@link ReferenceFilter}s (recursively). `_all`/`__typename` are skipped.
 */
function parseSelectionSet(
  selectionSet: SelectionSetNode,
  domain: string,
  nameMap?: GraphQLNameMap
): ParsedSelection {
  const filters: Record<string, string | string[]> = {}
  const ranges: Record<string, { min?: number; max?: number }> = {}
  const references: ReferenceFilter[] = []

  for (const field of selectionSet.selections) {
    if (field.kind !== 'Field') continue
    const name = field.name.value

    if (name === '_all' || name === '__typename') continue

    if (name === 'references') {
      // Reserved container field: each sub-field is a referenced asset.
      if (field.selectionSet) {
        for (const refField of field.selectionSet.selections) {
          if (refField.kind !== 'Field') continue
          references.push(parseReferenceField(refField, nameMap))
        }
      }
      continue
    }

    extractFilterOrRange(field, filters, ranges, domain, nameMap)
  }

  return { filters, ranges, references }
}

/**
 * Parse a referenced-asset field (`<domain>(label: "…") { … }`) into a
 * {@link ReferenceFilter}, recursing into its own `references`.
 */
function parseReferenceField(field: FieldNode, nameMap?: GraphQLNameMap): ReferenceFilter {
  const domain = nameMap?.domains.get(field.name.value) ?? field.name.value
  const ref: ReferenceFilter = { domain }

  for (const arg of field.arguments ?? []) {
    if (arg.name.value === 'label' && arg.value.kind === 'StringValue') {
      ref.label = arg.value.value
    }
  }

  if (field.selectionSet) {
    const inner = parseSelectionSet(field.selectionSet, domain, nameMap)
    if (Object.keys(inner.filters).length > 0) ref.filters = inner.filters
    if (Object.keys(inner.ranges).length > 0) ref.ranges = inner.ranges
    if (inner.references.length > 0) ref.references = inner.references
  }

  return ref
}

/**
 * Read a property field's arguments into `filters` (`values: [...]`) or `ranges`
 * (`min`/`max`). Filter values may be StringValues or EnumValues (the editor
 * schema models enum-encodable properties as GraphQL enums).
 */
function extractFilterOrRange(
  field: FieldNode,
  filters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  domain: string,
  nameMap?: GraphQLNameMap
): void {
  const fieldName =
    nameMap?.propertiesByDomain.get(domain)?.get(field.name.value) ?? field.name.value
  if (!field.arguments || field.arguments.length === 0) return

  for (const arg of field.arguments) {
    if (arg.name.value === 'values' && arg.value.kind === 'ListValue') {
      const values = arg.value.values
        .filter((v) => v.kind === 'StringValue' || v.kind === 'EnumValue')
        .map((v) => (v.kind === 'StringValue' || v.kind === 'EnumValue' ? v.value : ''))
        .filter((v) => v.length > 0)

      if (values.length === 1) {
        filters[fieldName] = values[0]!
      } else if (values.length > 1) {
        filters[fieldName] = values
      }
    } else if (arg.name.value === 'min' || arg.name.value === 'max') {
      if (!ranges[fieldName]) ranges[fieldName] = {}
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
