import { getConfig } from '@ontology-search/core/config'
import { ERROR_CODE } from '@ontology-search/core/errors'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { errorHandler } from './middleware/error-handler.js'
import { rateLimit } from './middleware/rate-limit.js'
import { requestId } from './middleware/request-id.js'
import { searchRoutes } from './routes/search.js'
import { statsRoutes } from './routes/stats.js'
import { traceabilityRoutes } from './routes/traceability.js'
import type { AppEnv } from './types.js'

const config = getConfig()

/**
 * Parse the CORS_ALLOWED_ORIGINS env var into a value the `cors`
 * middleware understands. `*` means "any origin" (development).
 * Production configs cross-validated against this combo in the Zod
 * loader — the API process won't start if NODE_ENV=production sees
 * `*` here.
 */
function parseAllowedOrigins(raw: string): string | string[] {
  const trimmed = raw.trim()
  if (trimmed === '*') return '*'
  return trimmed
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

const app = new Hono<AppEnv>()

app.use('*', logger())
app.use('*', cors({ origin: parseAllowedOrigins(config.CORS_ALLOWED_ORIGINS) }))
app.use(
  '*',
  rateLimit({
    rps: config.RATE_LIMIT_RPS,
    burst: config.RATE_LIMIT_BURST,
  })
)
app.use('*', requestId())
app.use(
  '/search/*',
  bodyLimit({
    maxSize: config.API_MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'Request body too large', code: ERROR_CODE.BAD_REQUEST }, 413),
  })
)
app.onError(errorHandler)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/search', searchRoutes)
app.route('/stats', statsRoutes)
app.route('/traceability', traceabilityRoutes)

export { app }
