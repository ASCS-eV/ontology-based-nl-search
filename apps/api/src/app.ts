import { getConfig } from '@ontology-search/core/config'
import { ERROR_CODE } from '@ontology-search/core/errors'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { apiKeyAuth } from './middleware/auth.js'
import { errorHandler } from './middleware/error-handler.js'
import { rateLimit } from './middleware/rate-limit.js'
import { requestId } from './middleware/request-id.js'
import { getReadiness } from './readiness.js'
import { metadataRoutes } from './routes/metadata.js'
import { searchRoutes } from './routes/search.js'
import { statsRoutes } from './routes/stats.js'
import { traceabilityRoutes } from './routes/traceability.js'
import { vocabularyRoutes } from './routes/vocabulary.js'
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
// Optional API-key gate. No-op unless API_KEY is set; `/health` stays open.
app.use('*', apiKeyAuth({ apiKey: config.API_KEY }))
app.use(
  '/search/*',
  bodyLimit({
    maxSize: config.API_MAX_BODY_BYTES,
    onError: (c) => c.json({ error: 'Request body too large', code: ERROR_CODE.BAD_REQUEST }, 413),
  })
)
app.onError(errorHandler)

/**
 * Liveness + readiness probe. Reports the real warmup state so a misconfigured
 * instance (e.g. ontology submodules not initialized → schema load failed) is
 * visibly unhealthy instead of returning `ok` while every search comes back
 * empty. Returns 503 until warmup succeeds so orchestrators don't route to it.
 */
app.get('/health', (c) => {
  const readiness = getReadiness()
  if (!readiness) return c.json({ status: 'starting' }, 503)
  if (readiness.ready) return c.json({ status: 'ok' })
  return c.json({ status: 'degraded', errors: readiness.errors }, 503)
})

app.route('/metadata', metadataRoutes)
app.route('/search', searchRoutes)
app.route('/stats', statsRoutes)
app.route('/traceability', traceabilityRoutes)
app.route('/vocabulary', vocabularyRoutes)

export { app }
