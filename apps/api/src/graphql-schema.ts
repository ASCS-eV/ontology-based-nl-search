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
  return {
    schema: buildGraphQLSchema(vocabulary),
    nameMap: buildGraphQLNameMap(vocabulary),
  }
}

/** Reset the process cache between isolated route tests. */
export function resetGraphQLContractForTests(): void {
  contractPromise = null
}
