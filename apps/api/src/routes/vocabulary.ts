/**
 * Vocabulary endpoint — exposes ontology metadata for frontend autocomplete.
 *
 * Returns domain names, property names (enum + numeric), and allowed values
 * from the SHACL vocabulary. This powers the GraphQL editor's autocomplete.
 */
import type { VocabProperty, VocabularyResponse } from '@ontology-search/api-types'
import { extractSchemaVocabulary, getInitializedStore } from '@ontology-search/search'
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
      // exclusively — never instance-derived values — so the eager
      // instance-value scan the old `extractVocabulary` performed was a
      // pure cold-cache latency cost with no payload effect (issue #121).
      const store = await getInitializedStore()
      const vocabulary = await extractSchemaVocabulary(store)

      const properties: VocabProperty[] = [
        ...vocabulary.enumProperties.map((p) => ({
          name: p.localName,
          label: p.label,
          description: p.description,
          domain: p.domain,
          type: 'enum' as const,
          allowedValues: p.allowedValues,
        })),
        ...vocabulary.numericProperties.map((p) => ({
          name: p.localName,
          label: p.label,
          description: p.description,
          domain: p.domain,
          type: 'numeric' as const,
          datatype: p.datatype,
        })),
      ]

      logger.info('Vocabulary request completed', {
        domains: vocabulary.domains.length,
        properties: properties.length,
      })

      return {
        domains: vocabulary.domains,
        properties,
      }
    },
  })
)
