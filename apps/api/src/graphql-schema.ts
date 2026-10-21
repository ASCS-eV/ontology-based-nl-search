import { enumPropertyMembers } from '@ontology-search/core/graphql/enum'
import {
  buildGraphQLNameMap,
  buildGraphQLSchema,
  type GraphQLNameMap,
} from '@ontology-search/graphql-ir'
import { buildTermIndex, getInitializedStore, toVocabularyResponse } from '@ontology-search/search'
import type { GraphQLSchema } from 'graphql'

export interface GraphQLContract {
  schema: GraphQLSchema
  nameMap: GraphQLNameMap
  /**
   * Per domain, the property keys the schema types as enums, whose filter
   * values the serializer must emit as enum literals — derived from the same
   * vocabulary by the same rule as the schema, so the two cannot disagree.
   */
  enumProperties: ReadonlyMap<string, ReadonlySet<string>>
}

let contractPromise: Promise<GraphQLContract> | null = null

/** Build the ontology-derived GraphQL contract once for the process. */
export async function getGraphQLContract(): Promise<GraphQLContract> {
  if (contractPromise) return contractPromise

  const pending = buildGraphQLContract()
  contractPromise = pending
  try {
    return await pending
  } catch (error) {
    if (contractPromise === pending) contractPromise = null
    throw error
  }
}

async function buildGraphQLContract(): Promise<GraphQLContract> {
  const store = await getInitializedStore()
  const vocabulary = toVocabularyResponse(await buildTermIndex(store))
  // A field is an enum when its own domain's property is enumerated and its
  // values are encodable as enum names — the rule `buildGraphQLSchema` types by.
  const enumerated = vocabulary.properties.filter((p) => p.type === 'enum')
  const encodable = enumPropertyMembers(
    enumerated.map((p) => ({ name: p.name, allowedValues: p.allowedValues ?? [] }))
  )
  const enumProperties = new Map<string, Set<string>>()
  for (const property of enumerated) {
    if (!encodable.has(property.name)) continue
    const names = enumProperties.get(property.domain) ?? new Set<string>()
    enumProperties.set(property.domain, names.add(property.name))
  }
  return {
    schema: buildGraphQLSchema(vocabulary),
    nameMap: buildGraphQLNameMap(vocabulary),
    enumProperties,
  }
}

/** Reset the process cache between isolated route tests. */
export function resetGraphQLContractForTests(): void {
  contractPromise = null
}
