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
 */
import { enumPropertyMembers } from '@ontology-search/core/graphql/enum'
import {
  GraphQLBoolean,
  GraphQLEnumType,
  type GraphQLFieldConfigMap,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
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

/**
 * Permissive scalar for reference-scoped `filters`/`ranges`, whose keys are
 * property names and therefore cannot be modelled as strict GraphQL input
 * fields. Accepts any literal (ADR 0001, open follow-up).
 */
const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: () => null,
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
  const referenceInput: GraphQLInputObjectType = new GraphQLInputObjectType({
    name: 'ReferenceInput',
    description:
      "Constrain assets by a referenced asset (e.g. a trace's referenced map). " +
      '`filters`/`ranges` apply to the referenced asset, not the parent.',
    fields: () => ({
      domain: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Domain of the referenced asset.',
      },
      label: { type: GraphQLString, description: 'Optional label to bind the referenced asset.' },
      filters: {
        type: JSONScalar,
        description: 'Categorical constraints on the referenced asset, e.g. `{ country: ["DE"] }`.',
      },
      ranges: {
        type: JSONScalar,
        description:
          'Numeric constraints on the referenced asset, e.g. `{ numberIntersections: { min: 1 } }`.',
      },
      references: { type: new GraphQLList(referenceInput), description: 'Nested references.' },
    }),
  })

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

  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {}

  for (const domain of vocab.domains) {
    const props = propsByDomain.get(domain) ?? []
    const domainType = new GraphQLObjectType({
      name: `${sanitizeName(domain)}_Result`,
      description: `Constraints on "${domain}" assets. List a field to constrain that property; an asset matches when all listed constraints hold.`,
      fields: () => {
        const fields: GraphQLFieldConfigMap<unknown, unknown> = {
          _all: {
            type: GraphQLBoolean,
            description: `Match every "${domain}" asset (no property constraints).`,
          },
        }
        for (const property of props) {
          const fieldName = sanitizeName(property.name)
          if (property.type === 'numeric') {
            fields[fieldName] = {
              type: RangeScalar,
              description: describeProperty(property),
              args: {
                min: { type: GraphQLFloat, description: 'Lower bound (inclusive).' },
                max: { type: GraphQLFloat, description: 'Upper bound (inclusive).' },
              },
            }
          } else {
            const allowed = property.allowedValues ?? []
            const hint = allowed.length > 0 ? ` Allowed: ${allowed.join(', ')}.` : ''
            // Enum-encodable categorical properties use a shared per-name enum
            // so cm6-graphql suggests each value; the serializer (same decision
            // via enumPropertyMembers) emits matching enum literals, so the
            // prefilled query validates and round-trips. Others stay strings.
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
      },
    })

    queryFields[sanitizeName(domain)] = {
      type: domainType,
      description: `Search "${domain}" assets.`,
      args: {
        references: {
          type: new GraphQLList(referenceInput),
          description: 'Constrain by referenced assets (e.g. a referenced map).',
        },
      },
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
        'nested fields are its discovered properties.',
      fields: queryFields,
    }),
  })
}
