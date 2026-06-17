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
 * | Ref filters/ranges | `references: [{ filters, ranges }]` (object value) | §2.9.8 |
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
 *   domains: ['assetDomain'],
 *   filters: { country: 'Germany', roadType: 'motorway' },
 *   ranges: { numberOfLanes: { min: 3 } },
 * })
 * // Returns:
 * // query {
 * //   assetDomain {
 * //     country(values: ["Germany"])
 * //     numberOfLanes(min: 3)
 * //     roadType(values: ["motorway"])
 * //   }
 * // }
 * ```
 */
export function slotsToGraphQL(slots: SearchSlots): string {
  // Exhaustiveness guard: destructuring every SearchSlots field means adding a
  // new field without handling it here makes `rest` non-empty, which fails the
  // `Record<string, never>` assignment at compile time. This turns silent
  // GraphQL↔SPARQL drift (a new slot the GraphQL codec forgets) into a build
  // error. No runtime effect.
  const { domains, filters, ranges, references, ...rest } = slots
  const _exhaustive: Record<string, never> = rest

  const sortedDomains = [...domains].sort()
  if (sortedDomains.length === 0) {
    return 'query {\n  _empty\n}'
  }

  const domainBlocks = sortedDomains.map((domain) =>
    buildDomainBlock(domain, filters, ranges, references)
  )
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

function buildDomainBlock(
  domain: string,
  filters: SearchSlots['filters'],
  ranges: SearchSlots['ranges'],
  references: SearchSlots['references']
): string {
  const indent = '  '
  const fieldIndent = '    '

  const safeDomain = sanitizeFieldName(domain)
  const referencesArg = buildReferencesArg(references)
  const domainHeader = referencesArg
    ? `${indent}${safeDomain}(${referencesArg}) {`
    : `${indent}${safeDomain} {`

  const fields = buildFields(filters, ranges, fieldIndent)

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
  // Exhaustiveness guard (see slotsToGraphQL): a new ReferenceFilter field must
  // be handled here, or the build fails — preventing silent drift from the
  // compiler, which consumes the same fields.
  const { domain, label, filters, ranges, references, ...rest } = ref
  const _exhaustive: Record<string, never> = rest

  const parts: string[] = [`domain: "${escapeGraphQLString(domain)}"`]

  if (label) {
    parts.push(`label: "${escapeGraphQLString(label)}"`)
  }

  // Reference-scoped constraints describe the REFERENCED asset (e.g. referenced
  // maps in a country, or with a numeric threshold). They are emitted as nested
  // object-value arguments so the GraphQL stays equivalent to the compiled
  // SPARQL, which binds them to the referenced asset's variable.
  const filtersObj = serializeRefFilters(filters)
  if (filtersObj) parts.push(`filters: ${filtersObj}`)

  const rangesObj = serializeRefRanges(ranges)
  if (rangesObj) parts.push(`ranges: ${rangesObj}`)

  if (references && references.length > 0) {
    const nested = references.map(serializeReference)
    parts.push(`references: [${nested.join(', ')}]`)
  }

  return `{ ${parts.join(', ')} }`
}

/**
 * Serialize reference-scoped property filters as a GraphQL object value
 * (`{ key: ["v1", "v2"], … }`), mirroring the top-level `values: [...]` filters.
 * @see https://spec.graphql.org/September2025/#sec-Object-Value — §2.9.8
 */
function serializeRefFilters(
  filters: Record<string, string | string[]> | undefined
): string | null {
  if (!filters) return null
  const fields: string[] = []
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key]
    if (value === undefined) continue
    const values = (Array.isArray(value) ? value : [value]).filter((v) => v.length > 0)
    if (values.length === 0) continue
    const valuesStr = [...values]
      .sort()
      .map((v) => `"${escapeGraphQLString(v)}"`)
      .join(', ')
    fields.push(`${sanitizeFieldName(key)}: [${valuesStr}]`)
  }
  return fields.length > 0 ? `{ ${fields.join(', ')} }` : null
}

/**
 * Serialize reference-scoped numeric ranges as a GraphQL object value
 * (`{ key: { min: 1, max: 4 }, … }`).
 * @see https://spec.graphql.org/September2025/#sec-Object-Value — §2.9.8
 */
function serializeRefRanges(
  ranges: Record<string, { min?: number; max?: number }> | undefined
): string | null {
  if (!ranges) return null
  const fields: string[] = []
  for (const key of Object.keys(ranges).sort()) {
    const range = ranges[key]
    const args: string[] = []
    if (range?.min !== undefined) args.push(`min: ${range.min}`)
    if (range?.max !== undefined) args.push(`max: ${range.max}`)
    if (args.length > 0) fields.push(`${sanitizeFieldName(key)}: { ${args.join(', ')} }`)
  }
  return fields.length > 0 ? `{ ${fields.join(', ')} }` : null
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
