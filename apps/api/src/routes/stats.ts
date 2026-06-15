import type { StatsResponse } from '@ontology-search/api-types'
import { getConfig } from '@ontology-search/core/config'
import { Hono } from 'hono'

import { countAssets } from '../services/count-assets.js'
import type { AppEnv } from '../types.js'
import { handleRoute } from './handler.js'

export const statsRoutes = new Hono<AppEnv>()

statsRoutes.get('/', (c) =>
  handleRoute<StatsResponse>(c, {
    label: 'Stats',
    errorMessage: 'Failed to retrieve statistics',
    handler: async (_c, logger) => {
      logger.info('Stats request started')
      const { counts, totalAssets, availableDomains } = await countAssets(logger)
      logger.info('Stats request completed', {
        totalAssets,
        domainCount: Object.keys(counts).length,
      })
      return {
        totalAssets,
        domains: counts,
        availableDomains,
        features: {
          graphqlLayer: getConfig().FEATURE_GRAPHQL_LAYER,
        },
      }
    },
  })
)
