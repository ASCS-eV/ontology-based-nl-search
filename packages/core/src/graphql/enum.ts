/**
 * GraphQL enum-name helpers — shared by the editor schema builder (web) and the
 * GraphQL serializer (search) so they agree on which discovered properties can
 * be modelled as GraphQL enums (enabling value autocomplete) versus plain
 * strings. Keeping the decision in one place stops the two codecs from drifting.
 *
 * @see https://spec.graphql.org/September2025/#sec-Names — §2.1.9 (Name)
 * @see https://spec.graphql.org/September2025/#sec-Enum-Value — enum values are
 *      Names excluding `true`, `false`, and `null`.
 */

const NAME = /^[_A-Za-z][_0-9A-Za-z]*$/
const RESERVED = new Set(['true', 'false', 'null'])

/** True if `value` is usable verbatim as a GraphQL enum value (a Name, not reserved). */
export function isGraphQLEnumName(value: string): boolean {
  return NAME.test(value) && !RESERVED.has(value)
}

/**
 * Decide whether a property's enumerated values can be modelled as a GraphQL
 * enum. Returns the sorted, de-duplicated values to use as enum members when
 * every value is a valid, reversible enum name; otherwise `null`, signalling a
 * `String` fallback. Reversibility matters: an enum member must equal the
 * original value verbatim so a query round-trips to the same slot value.
 */
export function enumEncodableValues(allowedValues: readonly string[]): string[] | null {
  if (allowedValues.length === 0) return null
  const unique = [...new Set(allowedValues)]
  if (!unique.every(isGraphQLEnumName)) return null
  return unique.sort()
}

/** A categorical property identified by name with its enumerated allowed values. */
export interface NamedAllowedValues {
  name: string
  allowedValues?: readonly string[]
}

/**
 * Across a set of (possibly per-domain) categorical properties, decide which
 * property NAMES can be modelled as a shared GraphQL enum, returning each
 * qualifying name → its sorted enum members. A name qualifies only if the union
 * of its allowed values across all occurrences is fully enum-encodable.
 *
 * The serializer has no domain context (slot filters are keyed by name), so the
 * decision must be per-name and global. Having the editor schema and the
 * serializer both derive their enum set from this one function keeps them in
 * lockstep: the schema types exactly the names this returns as enums, and the
 * serializer emits enum literals for exactly those names.
 */
export function enumPropertyMembers(
  properties: readonly NamedAllowedValues[]
): Map<string, string[]> {
  const valuesByName = new Map<string, Set<string>>()
  for (const property of properties) {
    const set = valuesByName.get(property.name) ?? new Set<string>()
    for (const value of property.allowedValues ?? []) set.add(value)
    valuesByName.set(property.name, set)
  }

  const out = new Map<string, string[]>()
  for (const [name, values] of valuesByName) {
    const members = enumEncodableValues([...values])
    if (members) out.set(name, members)
  }
  return out
}
