import { internalError } from '@ontology-search/core/errors'
import { REQUEST_ID_HEADER, RequestLogger } from '@ontology-search/core/logging'
import { Hono } from 'hono'

import { countAssets } from '../services/count-assets.js'
import type { AppEnv } from '../types.js'

export const statsRoutes = new Hono<AppEnv>()

statsRoutes.get('/', async (c) => {
  const requestId = c.get('requestId') as string
  const logger = new RequestLogger({ requestId })

  try {
    logger.info('Stats request started')
    const { counts, totalAssets, availableDomains } = await countAssets(logger)

    logger.info('Stats request completed', { totalAssets, domainCount: Object.keys(counts).length })

    return c.json({ totalAssets, domains: counts, availableDomains }, 200, {
      [REQUEST_ID_HEADER]: requestId,
    })
  } catch (error) {
    logger.error('Stats API error', error)
    const err = internalError('Failed to retrieve statistics')
    return c.json(err.body, err.status)
  }
})
