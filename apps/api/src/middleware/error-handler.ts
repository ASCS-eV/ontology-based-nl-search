import { extractErrorMessage } from '@ontology-search/core/errors'
import type { Context } from 'hono'

import type { AppEnv } from '../types.js'

export function errorHandler(err: Error, c: Context<AppEnv>) {
  const message = extractErrorMessage(err)
  console.error(`[${c.get('requestId') ?? 'unknown'}] Unhandled error:`, message)

  return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)
}
