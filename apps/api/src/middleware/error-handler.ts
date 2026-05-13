import { extractErrorMessage } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'
import type { Context } from 'hono'

import type { AppEnv } from '../types.js'

const logger = createComponentLogger('error-handler')

export function errorHandler(err: Error, c: Context<AppEnv>) {
  const message = extractErrorMessage(err)
  logger.error(`Unhandled error [${c.get('requestId') ?? 'unknown'}]`, { message })

  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)
}
