/**
 * GraphQL Serializer — deterministic SearchSlots → GraphQL query string.
 *
 * Produces a readable, valid GraphQL query from the structured search slots.
 * This is a one-way serializer (Slots → GraphQL); the reverse parser lives
 * in `graphql-parser.ts` (Phase 2).
 *
 * Design: Pure string builder with no external dependencies. The `graphql`
 * npm package is NOT required here — we control the output shape entirely
 * and can produce valid GraphQL syntax from simple string concatenation.
 *
 * Determinism: Same slots always produce the same GraphQL string. Filters
 * are sorted alphabetically by key; array values are sorted lexicographically.
 */

import type { ReferenceFilter, SearchSlots } from './slots.js'

/**
 * Convert SearchSlots into a human-readable GraphQL query string.
 *
 * The output shape mirrors the slot structure:
 * - `domains` → root query field(s)
 * - `filters` → field arguments with `values: [...]`
 * - `ranges` → field arguments with `min`/`max`
 * - `references` → `references` argument on root field
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
  if (domains.length === 0) return 'query {\n  # No domain selected\n}'

  const domainBlocks = domains.map((domain) => buildDomainBlock(domain, slots))
  const body = domainBlocks.join('\n')

  return `query {\n${body}\n}`
}

function buildDomainBlock(domain: string, slots: SearchSlots): string {
  const indent = '  '
  const fieldIndent = '    '

  const referencesArg = buildReferencesArg(slots.references)
  const domainHeader = referencesArg
    ? `${indent}${domain}(${referencesArg}) {`
    : `${indent}${domain} {`

  const fields = buildFields(slots.filters, slots.ranges, fieldIndent)

  if (fields.length === 0) {
    return `${domainHeader}\n${fieldIndent}# All assets in this domain\n${indent}}`
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
    if (key in filters) {
      const value = filters[key]
      if (value !== undefined) {
        const values = Array.isArray(value) ? value : [value]
        const sortedValues = [...values].sort()
        const valuesStr = sortedValues.map((v) => `"${escapeGraphQLString(v)}"`).join(', ')
        lines.push(`${indent}${key}(values: [${valuesStr}])`)
      }
    }

    if (key in ranges) {
      const range = ranges[key]
      const args: string[] = []
      if (range?.min !== undefined) args.push(`min: ${range.min}`)
      if (range?.max !== undefined) args.push(`max: ${range.max}`)
      if (args.length > 0) {
        lines.push(`${indent}${key}(${args.join(', ')})`)
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

/** Escape special characters in a GraphQL string literal. */
function escapeGraphQLString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}
