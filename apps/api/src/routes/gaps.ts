/**
 * `GET /gaps` — the ontology gap log, for the people who maintain the ontology.
 *
 * Answers 404 while `FEATURE_GAP_LOG` is off: the resource does not exist
 * unless the deployment chose to keep it.
 *
 * STANDARDS — [RFC8259] JSON body over [RFC9110] (§15.5.5 404 Not Found while
 * disabled); the body is `GapLogResponse` from `@ontology-search/api-types`.
 */
import type { GapLogResponse } from '@ontology-search/api-types'
import { getConfig } from '@ontology-search/core/config'
import { notFound } from '@ontology-search/core/errors'
import { Hono } from 'hono'

import { getGapLog } from '../gap-log.js'
import type { AppEnv } from '../types.js'
import { handleRoute } from './handler.js'

export const gapRoutes = new Hono<AppEnv>()

gapRoutes.get('/', (c) =>
  handleRoute<GapLogResponse>(c, {
    label: 'Gap log',
    errorMessage: 'Failed to read the gap log',
    handler: async (_c, logger) => {
      if (!getConfig().FEATURE_GAP_LOG) return notFound('The gap log is not enabled')
      const snapshot = getGapLog().snapshot()
      logger.info('Gap log read', { terms: snapshot.entries.length })
      return snapshot
    },
  })
)
