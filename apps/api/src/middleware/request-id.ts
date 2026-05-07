import { generateRequestId, REQUEST_ID_HEADER } from '@ontology-search/core/logging'
import { createMiddleware } from 'hono/factory'

import type { AppEnv } from '../types.js'

export function requestId() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const id = generateRequestId()
    c.set('requestId', id)
    c.header(REQUEST_ID_HEADER, id)
    await next()
  })
}
