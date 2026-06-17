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
import {
  GraphQLBoolean,
  type GraphQLFieldConfigArgumentMap,
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

export function buildGraphQLSchema(vocab: Vocabulary): GraphQLSchema {
  const referenceInput: GraphQLInputObjectType = new GraphQLInputObjectType({
    name: 'ReferenceInput',
    fields: () => ({
      domain: { type: new GraphQLNonNull(GraphQLString) },
      label: { type: GraphQLString },
      filters: { type: JSONScalar },
      ranges: { type: JSONScalar },
      references: { type: new GraphQLList(referenceInput) },
    }),
  })

  const propsByDomain = new Map<string, VocabProperty[]>()
  for (const property of vocab.properties) {
    const list = propsByDomain.get(property.domain) ?? []
    list.push(property)
    propsByDomain.set(property.domain, list)
  }

  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {}

  for (const domain of vocab.domains) {
    const props = propsByDomain.get(domain) ?? []
    const domainType = new GraphQLObjectType({
      name: `${sanitizeName(domain)}_Result`,
      fields: () => {
        const fields: GraphQLFieldConfigMap<unknown, unknown> = {
          _all: { type: GraphQLBoolean },
        }
        for (const property of props) {
          const args: GraphQLFieldConfigArgumentMap =
            property.type === 'numeric'
              ? { min: { type: GraphQLFloat }, max: { type: GraphQLFloat } }
              : { values: { type: new GraphQLList(GraphQLString) } }
          fields[sanitizeName(property.name)] = { type: GraphQLBoolean, args }
        }
        return fields
      },
    })

    queryFields[sanitizeName(domain)] = {
      type: domainType,
      args: { references: { type: new GraphQLList(referenceInput) } },
    }
  }

  // A GraphQL Query type must have at least one field.
  if (Object.keys(queryFields).length === 0) {
    queryFields._empty = { type: GraphQLBoolean }
  }

  return new GraphQLSchema({
    query: new GraphQLObjectType({ name: 'Query', fields: queryFields }),
  })
}
