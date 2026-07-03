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
 * | References       | `references` field (nested) | §2.5       |
 * | Referenced asset | Field under `references`  | §2.5         |
 * | Reference label  | Argument `label:`         | §2.6         |
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

import { isGraphQLEnumName } from '@ontology-search/core/graphql/enum'
import { createComponentLogger } from '@ontology-search/core/logging'
import type { ReferenceFilter, SearchSlots } from '@ontology-search/slots/slots'

import { validateGraphQL } from './graphql-validator.js'

const logger = createComponentLogger('graphql-serializer')

/** Options controlling how slots are rendered to GraphQL. */
export interface GraphQLSerializeOptions {
  /**
   * Property names whose filter values should be emitted as GraphQL enum
   * literals (unquoted) instead of strings, enabling value autocomplete in the
   * editor. Must match the editor schema's enum-typed properties: both derive
   * the set from the same discovered vocabulary via `enumEncodableValues`.
   */
  enumProperties?: ReadonlySet<string>
}

const EMPTY_SET: ReadonlySet<string> = new Set()

/**
 * Convert SearchSlots into a human-readable GraphQL query string.
 *
 * The output shape mirrors the slot structure:
 * - `domains` → root query field(s)
 * - `filters` → field arguments with `values: [...]`
 * - `ranges` → field arguments with `min`/`max`
 * - `references` → nested `references { <domain> { … } }` selection
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
export function slotsToGraphQL(slots: SearchSlots, options: GraphQLSerializeOptions = {}): string {
  // Exhaustiveness guard: destructuring every SearchSlots field means adding a
  // new field without handling it here makes `rest` non-empty, which fails the
  // `Record<string, never>` assignment at compile time. This turns silent
  // GraphQL↔SPARQL drift (a new slot the GraphQL codec forgets) into a build
  // error. No runtime effect.
  const { domains, filters, ranges, references, ...rest } = slots
  const _exhaustive: Record<string, never> = rest

  const enumProperties = options.enumProperties ?? EMPTY_SET

  const sortedDomains = [...domains].sort()
  if (sortedDomains.length === 0) {
    return 'query {\n  _empty\n}'
  }

  const domainBlocks = sortedDomains.map((domain) =>
    buildBlock(domain, undefined, filters, ranges, references, enumProperties, 1)
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

/**
 * Render one asset block (a top-level domain or a referenced asset) and its
 * nested references, recursively. A referenced asset is the same shape as a
 * domain — property fields plus its own `references` — so one routine renders
 * both, mirroring the editor schema where references are typed fields, not an
 * argument. `depth` is the indentation level (top-level domain = 1).
 * @see https://spec.graphql.org/September2025/#sec-Selection-Sets — §2.4
 */
function buildBlock(
  name: string,
  label: string | undefined,
  filters: SearchSlots['filters'],
  ranges: SearchSlots['ranges'],
  references: SearchSlots['references'],
  enumProperties: ReadonlySet<string>,
  depth: number
): string {
  const indent = '  '.repeat(depth)
  const fieldIndent = '  '.repeat(depth + 1)

  const labelArg = label ? `(label: "${escapeGraphQLString(label)}")` : ''
  const header = `${indent}${sanitizeFieldName(name)}${labelArg} {`

  const lines = buildFields(filters, ranges, fieldIndent, enumProperties)
  lines.push(...buildReferencesBlock(references, fieldIndent, enumProperties, depth + 1))

  // GraphQL requires a non-empty selection set.
  if (lines.length === 0) {
    lines.push(`${fieldIndent}_all`)
  }

  return `${header}\n${lines.join('\n')}\n${indent}}`
}

/**
 * Render the `references { … }` selection. Each reference becomes a nested asset
 * block keyed by its domain (with an optional `label` argument), constraining
 * the parent to assets that reference such an asset. Sorted by domain then label
 * for determinism. Returns an empty array when there are no references.
 */
function buildReferencesBlock(
  references: ReferenceFilter[] | undefined,
  indent: string,
  enumProperties: ReadonlySet<string>,
  depth: number
): string[] {
  if (!references || references.length === 0) return []

  const sorted = [...references].sort(
    (a, b) => a.domain.localeCompare(b.domain) || (a.label ?? '').localeCompare(b.label ?? '')
  )
  const blocks = sorted.map((ref) => {
    // Exhaustiveness guard (see slotsToGraphQL): a new ReferenceFilter field must
    // be handled here, or the build fails — preventing silent drift from the
    // compiler, which consumes the same fields.
    const { domain, label, filters, ranges, references: nested, ...rest } = ref
    const _exhaustive: Record<string, never> = rest
    void _exhaustive
    return buildBlock(domain, label, filters ?? {}, ranges ?? {}, nested, enumProperties, depth + 1)
  })

  return [`${indent}references {`, ...blocks, `${indent}}`]
}

function buildFields(
  filters: Record<string, string | string[]>,
  ranges: Record<string, { min?: number; max?: number }>,
  indent: string,
  enumProperties: ReadonlySet<string>
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
        // Enum-encoded properties emit unquoted enum literals (which the editor
        // schema types as enums, so each value autocompletes); everything else
        // stays a quoted string. A value that is unexpectedly not a valid enum
        // name falls back to a string so the output is always syntactically valid.
        const asEnum = enumProperties.has(key)
        const valuesStr = sortedValues
          .map((v) => (asEnum && isGraphQLEnumName(v) ? v : `"${escapeGraphQLString(v)}"`))
          .join(', ')
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
