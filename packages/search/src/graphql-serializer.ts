/**
 * GraphQL Serializer — deterministic SearchSlots → GraphQL query string.
 *
 * Produces a readable, spec-valid GraphQL query from the structured search
 * slots. This is a one-way serializer (Slots → GraphQL); the reverse parser
 * lives in `graphql-parser.ts`.
 *
 * ## Spec mapping (SearchSlots → GraphQL)
 *
 * Our intermediate representation maps to the GraphQL Language specification
 * (September 2025, GraphQL Foundation / Linux Foundation) as follows:
 *
 * | Slot concept     | GraphQL construct         | Spec section |
 * |------------------|---------------------------|--------------|
 * | Query root       | OperationDefinition       | §2.3         |
 * | Domain           | Field (top-level)         | §2.5         |
 * | Domain block     | SelectionSet              | §2.4         |
 * | Filter property  | Field (nested)            | §2.5         |
 * | Filter values    | Argument `values: [...]`  | §2.6         |
 * | Range min/max    | Arguments `min:` / `max:` | §2.6         |
 * | References       | Argument `references:`    | §2.6         |
 * | Field names      | Name token                | §2.1.9       |
 * | String values    | StringValue               | §2.9.4       |
 *
 * Every output is parsed with the reference `graphql-js` library (the
 * canonical implementation maintained by the GraphQL Foundation) to
 * guarantee syntactic validity. This mirrors the SPARQL pipeline where
 * `sparqljs` validates every compiled query.
 *
 * Determinism: Same slots always produce the same GraphQL string. Filters
 * are sorted alphabetically by key; array values are sorted lexicographically.
 *
 * @see https://spec.graphql.org/September2025/ — GraphQL Language Specification
 * @see https://github.com/graphql/graphql-js — Reference implementation (parse gate)
 * @see validateGraphQL in ./graphql-validator.ts — post-serialize validation
 */

import { createComponentLogger } from '@ontology-search/core/logging'

import { validateGraphQL } from './graphql-validator.js'
import type { ReferenceFilter, SearchSlots } from './slots.js'

const logger = createComponentLogger('graphql-serializer')

/**
 * Convert SearchSlots into a human-readable GraphQL query string.
 *
 * The output shape mirrors the slot structure:
 * - `domains` → root query field(s)
 * - `filters` → field arguments with `values: [...]`
 * - `ranges` → field arguments with `min`/`max`
 * - `references` → `references` argument on root field
 *
 * Every generated query is validated against the GraphQL spec via
 * `graphql-js` parse. If validation fails (a serializer bug), the
 * error is logged and the raw (invalid) string is still returned
 * so the UI can display it for debugging.
 *
 * @example
 * ```ts
 * slotsToGraphQL({
 *   domains: ['hdmap'],
 *   filters: { country: 'Germany', roadType: 'motorway' },
 *   ranges: { numberOfLanes: { min: 3 } },
 * })
 * // Returns:
 * // query {
 * //   hdmap {
 * //     country(values: ["Germany"])
 * //     numberOfLanes(min: 3)
 * //     roadType(values: ["motorway"])
 * //   }
 * // }
 * ```
 */
export function slotsToGraphQL(slots: SearchSlots): string {
  const domains = [...slots.domains].sort()
  if (domains.length === 0) {
    return 'query {\n  _empty\n}'
  }

  const domainBlocks = domains.map((domain) => buildDomainBlock(domain, slots))
  const body = domainBlocks.join('\n')

  const query = `query {\n${body}\n}`

  // Post-serialize validation: parse with graphql-js to guarantee spec compliance.
  // Mirrors the SPARQL pipeline where sparqljs validates every compiled query.
  const validation = validateGraphQL(query)
  if (!validation.valid) {
    // Log but don't throw — the UI should still show the (potentially invalid)
    // query for debugging. This indicates a serializer bug, not a user error.
    logger.error('Generated invalid GraphQL', {
      errors: validation.errors.join('; '),
      query,
    })
  }

  return query
}

function buildDomainBlock(domain: string, slots: SearchSlots): string {
  const indent = '  '
  const fieldIndent = '    '

  const safeDomain = sanitizeFieldName(domain)
  const referencesArg = buildReferencesArg(slots.references)
  const domainHeader = referencesArg
    ? `${indent}${safeDomain}(${referencesArg}) {`
    : `${indent}${safeDomain} {`

  const fields = buildFields(slots.filters, slots.ranges, fieldIndent)

  if (fields.length === 0) {
    // GraphQL requires at least one field in a selection set
    return `${domainHeader}\n${fieldIndent}_all\n${indent}}`
  }

  return `${domainHeader}\n${fields.join('\n')}\n${indent}}`
}

function buildFields(
  filters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  indent: string
): string[] {
  const lines: string[] = []

  // Collect all field names from both filters and ranges, sorted
  const filterKeys = Object.keys(filters).sort()
  const rangeKeys = Object.keys(ranges).sort()
  const allKeys = [...new Set([...filterKeys, ...rangeKeys])].sort()

  for (const key of allKeys) {
    const safeKey = sanitizeFieldName(key)

    if (key in filters) {
      const value = filters[key]
      if (value !== undefined) {
        const values = Array.isArray(value) ? value : [value]
        const sortedValues = [...values].sort()
        const valuesStr = sortedValues.map((v) => `"${escapeGraphQLString(v)}"`).join(', ')
        lines.push(`${indent}${safeKey}(values: [${valuesStr}])`)
      }
    }

    if (key in ranges) {
      const range = ranges[key]
      const args: string[] = []
      if (range?.min !== undefined) args.push(`min: ${range.min}`)
      if (range?.max !== undefined) args.push(`max: ${range.max}`)
      if (args.length > 0) {
        lines.push(`${indent}${safeKey}(${args.join(', ')})`)
      }
    }
  }

  return lines
}

function buildReferencesArg(references: ReferenceFilter[] | undefined): string {
  if (!references || references.length === 0) return ''

  const refObjects = references.map(serializeReference)
  return `references: [${refObjects.join(', ')}]`
}

function serializeReference(ref: ReferenceFilter): string {
  const parts: string[] = [`domain: "${escapeGraphQLString(ref.domain)}"`]

  if (ref.label) {
    parts.push(`label: "${escapeGraphQLString(ref.label)}"`)
  }

  if (ref.references && ref.references.length > 0) {
    const nested = ref.references.map(serializeReference)
    parts.push(`references: [${nested.join(', ')}]`)
  }

  return `{ ${parts.join(', ')} }`
}

/**
 * Escape special characters in a GraphQL string literal.
 * @see https://spec.graphql.org/September2025/#sec-String-Value — §2.9.4
 */
function escapeGraphQLString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Sanitize a slot key into a valid GraphQL field name.
 *
 * GraphQL spec §2.1.9 (Name): `[_A-Za-z][_0-9A-Za-z]*`
 * @see https://spec.graphql.org/September2025/#sec-Names
 *
 * Slot keys may contain colons (prefixed IRIs), hyphens, or start with
 * digits — all invalid in GraphQL. We replace illegal characters with
 * underscores and prefix digit-leading names.
 */
function sanitizeFieldName(name: string): string {
  // Replace any character that isn't [A-Za-z0-9_] with underscore
  let safe = name.replace(/[^A-Za-z0-9_]/g, '_')
  // Must start with [_A-Za-z]
  if (/^[0-9]/.test(safe)) {
    safe = `_${safe}`
  }
  // Empty after sanitization → fallback
  if (safe.length === 0) {
    safe = '_field'
  }
  return safe
}
