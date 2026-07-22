import type { VocabProperty, VocabularyResponse } from '@ontology-search/api-types'
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

import { buildGraphQLNameMap, sanitizeGraphQLName } from './graphql-name.js'

const FilterScalar = new GraphQLScalarType({
  name: 'Filter',
  description: 'A literal constraint - supply matching value(s) via `values: [...]`.',
  serialize: (value) => value,
})

const RangeScalar = new GraphQLScalarType({
  name: 'Range',
  description: 'A numeric constraint - supply bounds via `min:` and/or `max:`.',
  serialize: (value) => value,
})

/** Build the query schema shared by editor, API validation, and language servers. */
export function buildGraphQLSchema(vocabulary: VocabularyResponse): GraphQLSchema {
  const nameMap = buildGraphQLNameMap(vocabulary)

  const propsByDomain = new Map<string, VocabProperty[]>()
  for (const property of vocabulary.properties) {
    const list = propsByDomain.get(property.domain) ?? []
    list.push(property)
    propsByDomain.set(property.domain, list)
  }

  const enumMembersByName = enumPropertyMembers(
    vocabulary.properties.filter((property) => property.type === 'enum')
  )
  const enumTypeByName = new Map<string, GraphQLEnumType>()
  for (const [name, members] of enumMembersByName) {
    enumTypeByName.set(
      name,
      new GraphQLEnumType({
        name: `${sanitizeGraphQLName(name)}_Enum`,
        description: `Allowed values for ${name}.`,
        values: Object.fromEntries(members.map((member) => [member, { value: member }])),
      })
    )
  }

  const domainTypes = new Map<string, GraphQLObjectType>()

  function propertyFields(domain: string): GraphQLFieldConfigMap<unknown, unknown> {
    const fields: GraphQLFieldConfigMap<unknown, unknown> = {
      _all: {
        type: GraphQLBoolean,
        description: `Match every "${domain}" asset (no property constraints).`,
      },
    }

    for (const property of propsByDomain.get(domain) ?? []) {
      const fieldName = nameMap.propertyFieldsByDomain.get(domain)?.get(property.name)
      if (!fieldName) {
        throw new Error(`Validated GraphQL name missing for property "${property.name}".`)
      }
      if (property.type === 'numeric') {
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
        continue
      }

      const allowed = property.allowedValues ?? []
      const hint = allowed.length > 0 ? ` Allowed: ${allowed.join(', ')}.` : ''
      const enumType = enumTypeByName.get(property.name)
      fields[fieldName] = {
        type: FilterScalar,
        description: describeProperty(property) + hint,
        args: {
          values: {
            type: new GraphQLList(enumType ?? GraphQLString),
            description: enumType
              ? 'Value(s) to match - pick from the suggested values.'
              : `Value(s) to match.${hint}`,
          },
        },
      }
    }

    return fields
  }

  function domainType(domain: string): GraphQLObjectType {
    const existing = domainTypes.get(domain)
    if (existing) return existing

    const created = new GraphQLObjectType({
      name: `${nameMap.domainFields.get(domain)!}_Result`,
      description: `Constraints on "${domain}" assets. List a field to constrain that property; an asset matches when all listed constraints hold.`,
      fields: () => ({
        ...propertyFields(domain),
        references: {
          type: referencesType,
          description:
            'Constrain by referenced assets. This is a reserved editor field, like `_all`.',
        },
      }),
    })
    domainTypes.set(domain, created)
    return created
  }

  const referencesType = new GraphQLObjectType({
    name: 'References',
    description:
      'Referenced assets that constrain the parent. Each field is a referenceable domain.',
    fields: () =>
      Object.fromEntries(
        vocabulary.domains.map((domain) => [
          nameMap.domainFields.get(domain)!,
          {
            type: domainType(domain),
            description: `A referenced "${domain}" asset.`,
            args: {
              label: {
                type: GraphQLString,
                description: 'Optional label to bind the referenced asset.',
              },
            },
          },
        ])
      ),
  })

  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = Object.fromEntries(
    vocabulary.domains.map((domain) => [
      nameMap.domainFields.get(domain)!,
      { type: domainType(domain), description: `Search "${domain}" assets.` },
    ])
  )
  if (Object.keys(queryFields).length === 0) queryFields._empty = { type: GraphQLBoolean }

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      description:
        'Ontology-driven asset search. Top-level fields are asset domains; nested fields are discovered properties and references.',
      fields: queryFields,
    }),
  })
}

function describeProperty(property: VocabProperty): string {
  const base = property.description.trim() || property.label.trim() || property.name
  if (property.type === 'numeric' && property.datatype) {
    return `${base} (${property.datatype})`
  }
  return base
}
