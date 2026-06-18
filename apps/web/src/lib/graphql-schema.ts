/**
 * Build a GraphQL `GraphQLSchema` from the runtime-discovered vocabulary.
 *
 * This is the editor's query contract: it is fed to `cm6-graphql` for
 * schema-aware autocomplete / validation / hover, and used with
 * `graphql.validate` to reject queries that reference unknown domains or
 * fields. It is built from the same discovery the SPARQL compiler uses (the
 * `/vocabulary` API), so it is ontology-source-agnostic and cannot drift from
 * the compiler. See `docs/adr/0001-graphql-editor-schema-from-discovery.md`.
 *
 * Field names mirror the serializer's sanitization so the queries
 * `slotsToGraphQL` produces validate against this schema.
 *
 * References are modelled as recursive *fields*, not an input-object argument:
 * every domain result type carries a `references` field whose sub-fields are the
 * referenceable domains, each typed as that domain's own result type. This gives
 * full per-domain typing / autocomplete / validation at any reference depth and
 * reuses one projection (`domain -> result type`) everywhere. See
 * `docs/adr/0002-field-based-recursive-references.md`.
 */
import { enumPropertyMembers } from '@ontology-search/core/graphql/enum'
import {
  GraphQLBoolean,
  GraphQLEnumType,
  type GraphQLFieldConfigMap,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql'

import type { VocabProperty, Vocabulary } from '../hooks/useVocabulary'

/** GraphQL Names match `[_A-Za-z][_0-9A-Za-z]*` — mirror the serializer's sanitizer. */
function sanitizeName(name: string): string {
  let safe = name.replace(/[^A-Za-z0-9_]/g, '_')
  if (/^[0-9]/.test(safe)) safe = `_${safe}`
  return safe.length > 0 ? safe : '_field'
}

/**
 * Leaf scalars whose NAMES make the editor's autocomplete self-describing:
 * instead of every constraint showing as ": Boolean", a categorical property
 * reads as ": Filter" and a numeric one as ": Range". They are leaf types (the
 * query never selects into them) — only the displayed type name differs.
 */
const FilterScalar = new GraphQLScalarType({
  name: 'Filter',
  description: 'A categorical constraint — supply matching value(s) via `values: [...]`.',
  serialize: (value) => value,
})
const RangeScalar = new GraphQLScalarType({
  name: 'Range',
  description: 'A numeric constraint — supply bounds via `min:` and/or `max:`.',
  serialize: (value) => value,
})

/** Human-readable field description from the discovered vocabulary. */
function describeProperty(property: VocabProperty): string {
  const base = (property.description ?? '').trim() || (property.label ?? '').trim() || property.name
  if (property.type === 'numeric' && property.datatype) {
    return `${base} (${property.datatype})`
  }
  return base
}

/** Build a GraphQL enum-value config map (member name === original value). */
function toEnumValueConfig(values: string[]): Record<string, { value: string }> {
  const out: Record<string, { value: string }> = {}
  for (const value of values) out[value] = { value }
  return out
}

export function buildGraphQLSchema(vocab: Vocabulary): GraphQLSchema {
  const propsByDomain = new Map<string, VocabProperty[]>()
  for (const property of vocab.properties) {
    const list = propsByDomain.get(property.domain) ?? []
    list.push(property)
    propsByDomain.set(property.domain, list)
  }

  // Shared, per-NAME enum types for enum-encodable categorical properties. The
  // decision is global per name (not per domain) because the serializer keys
  // filters by name only; both sides derive it from `enumPropertyMembers`, so
  // the schema types exactly the names the serializer emits as enum literals.
  const enumMembersByName = enumPropertyMembers(
    vocab.properties.filter((property) => property.type === 'enum')
  )
  const enumTypeByName = new Map<string, GraphQLEnumType>()
  for (const [name, members] of enumMembersByName) {
    enumTypeByName.set(
      name,
      new GraphQLEnumType({
        name: `${sanitizeName(name)}_Enum`,
        description: `Allowed values for ${name}.`,
        values: toEnumValueConfig(members),
      })
    )
  }

  // Per-domain result types, created once and shared so the recursive
  // `references` field can point back into them (a `trace` may reference a
  // `map`, which may itself reference further assets, to any depth).
  const domainTypes = new Map<string, GraphQLObjectType>()

  /** The property-constraint fields a domain exposes (filters + ranges). */
  function buildPropertyFields(domain: string): GraphQLFieldConfigMap<unknown, unknown> {
    const fields: GraphQLFieldConfigMap<unknown, unknown> = {
      _all: {
        type: GraphQLBoolean,
        description: `Match every "${domain}" asset (no property constraints).`,
      },
    }
    for (const property of propsByDomain.get(domain) ?? []) {
      const fieldName = sanitizeName(property.name)
      if (property.type === 'numeric') {
        // Type the bounds by the real datatype so the editor shows Int vs Float
        // and rejects 1.5 on an integer field; surface the datatype in the
        // argument description too (cm6-graphql renders the description, not the
        // argument type, in its completion info panel).
        const boundType = property.datatype === 'integer' ? GraphQLInt : GraphQLFloat
        const datatype = property.datatype ?? 'number'
        fields[fieldName] = {
          type: RangeScalar,
          description: describeProperty(property),
          args: {
            min: { type: boundType, description: `Lower bound, inclusive (${datatype}).` },
            max: { type: boundType, description: `Upper bound, inclusive (${datatype}).` },
          },
        }
      } else {
        const allowed = property.allowedValues ?? []
        const hint = allowed.length > 0 ? ` Allowed: ${allowed.join(', ')}.` : ''
        // Enum-encodable categorical properties use a shared per-name enum so
        // cm6-graphql suggests each value; the serializer (same decision via
        // enumPropertyMembers) emits matching enum literals, so the prefilled
        // query validates and round-trips. Others stay strings.
        const enumType = enumTypeByName.get(property.name)
        const valueType = enumType ?? GraphQLString
        fields[fieldName] = {
          type: FilterScalar,
          description: describeProperty(property) + hint,
          args: {
            values: {
              type: new GraphQLList(valueType),
              description: enumType
                ? 'Value(s) to match — pick from the suggested values.'
                : `Value(s) to match.${hint}`,
            },
          },
        }
      }
    }
    return fields
  }

  function getDomainType(domain: string): GraphQLObjectType {
    const existing = domainTypes.get(domain)
    if (existing) return existing
    const type = new GraphQLObjectType({
      name: `${sanitizeName(domain)}_Result`,
      description: `Constraints on "${domain}" assets. List a field to constrain that property; an asset matches when all listed constraints hold.`,
      // Lazy thunk: the `references` field points at `referencesType`, which in
      // turn points back at domain result types — a legal cyclic schema only
      // because both sides are resolved lazily.
      fields: () => ({
        ...buildPropertyFields(domain),
        references: {
          type: referencesType,
          description:
            'Constrain by referenced assets (e.g. a referenced map). A reserved ' +
            'editor field, like `_all`.',
        },
      }),
    })
    domainTypes.set(domain, type)
    return type
  }

  // One shared `References` type: a field per discovered domain, each returning
  // that domain's result type and accepting an optional `label`. It is shared
  // (not per-parent) because any domain may be referenced from any domain today
  // — the compiler discovers the SPARQL join. When relation edges are
  // discovered from SHACL (the meta-model rework), this narrows to per-parent,
  // predicate-named fields without changing the recursive structure.
  const referencesType = new GraphQLObjectType({
    name: 'References',
    description:
      'Referenced assets that constrain the parent. Each field is a referenceable ' +
      'domain; selecting it constrains the parent to assets referencing such an asset.',
    fields: () => {
      const fields: GraphQLFieldConfigMap<unknown, unknown> = {}
      for (const domain of vocab.domains) {
        fields[sanitizeName(domain)] = {
          type: getDomainType(domain),
          description: `A referenced "${domain}" asset.`,
          args: {
            label: {
              type: GraphQLString,
              description: 'Optional label to bind the referenced asset.',
            },
          },
        }
      }
      return fields
    },
  })

  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {}
  for (const domain of vocab.domains) {
    queryFields[sanitizeName(domain)] = {
      type: getDomainType(domain),
      description: `Search "${domain}" assets.`,
    }
  }

  // A GraphQL Query type must have at least one field.
  if (Object.keys(queryFields).length === 0) {
    queryFields._empty = { type: GraphQLBoolean }
  }

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      description:
        'Ontology-driven asset search. Each top-level field is a discovered asset domain; ' +
        'nested fields are its discovered properties, and `references` nests referenced assets.',
      fields: queryFields,
    }),
  })
}
