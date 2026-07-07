/**
 * Vocabulary endpoint — exposes ontology metadata for frontend autocomplete.
 *
 * Projects the shared schema term index (the same one LLM retrieval reads)
 * into the wire shape the GraphQL editor consumes: domain names, property
 * names (enum + numeric), and allowed values. One index, one projection —
 * the editor cannot drift from what the interpreter and compiler see.
 */
import type { VocabularyResponse } from '@ontology-search/api-types'
import { buildTermIndex, getInitializedStore, toVocabularyResponse } from '@ontology-search/search'
import { Hono } from 'hono'

import type { AppEnv } from '../types.js'
import { handleRoute } from './handler.js'

export const vocabularyRoutes = new Hono<AppEnv>()

vocabularyRoutes.get('/', (c) =>
  handleRoute<VocabularyResponse>(c, {
    label: 'Vocabulary',
    errorMessage: 'Failed to retrieve vocabulary',
    handler: async (_c, logger) => {
      logger.info('Vocabulary request started')
      // Schema-only: the response carries sh:in enumerations and datatypes
      // exclusively — never instance-derived values.
      const store = await getInitializedStore()
      const response = toVocabularyResponse(await buildTermIndex(store))

      logger.info('Vocabulary request completed', {
        domains: response.domains.length,
        properties: response.properties.length,
      })

      return response
    },
  })
)
