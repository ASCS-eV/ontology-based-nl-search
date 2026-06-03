/**
 * Optional API-key authentication middleware.
 *
 * When `apiKey` is empty (the default), this is a zero-cost passthrough — the
 * API stays open, which is the right default for local development and for
 * deployments that terminate authentication at an upstream gateway. When
 * `apiKey` is set, every request except the `/health` readiness probe must
 * present the key, as either `Authorization: Bearer <key>` or
 * `x-api-key: <key>`; anything else gets HTTP 401.
 *
 * The key comparison is constant-time (`crypto.timingSafeEqual`) so a wrong
 * key cannot be recovered by timing the response. `/health` stays open so
 * orchestrators can probe readiness without holding the secret.
 *
 * Mirrors the {@link ../middleware/rate-limit.ts | rate-limit} middleware's
 * "disabled-when-unset → passthrough" shape so `app.use('*', apiKeyAuth(...))`
 * is safe to register unconditionally.
 */
import { timingSafeEqual } from 'node:crypto'

import { ERROR_CODE } from '@ontology-search/core/errors'
import { createMiddleware } from 'hono/factory'

import type { AppEnv } from '../types.js'

/** Path that must stay reachable without auth so readiness probes work. */
const HEALTH_PATH = '/health'

/** Pull a presented key from `Authorization: Bearer …` or `x-api-key`. */
function extractKey(headers: Headers): string | null {
  const authorization = headers.get('authorization')
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
    if (match?.[1]) return match[1].trim()
  }
  const apiKeyHeader = headers.get('x-api-key')
  if (apiKeyHeader) return apiKeyHeader.trim()
  return null
}

/**
 * Constant-time string equality. The length check short-circuits before
 * `timingSafeEqual` (which throws on unequal-length buffers); leaking only
 * the key length is acceptable, the key bytes are not compared in variable time.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function apiKeyAuth(options: { apiKey: string | undefined }) {
  const expected = options.apiKey?.trim() ?? ''

  // Disabled path: open API, zero-cost passthrough.
  if (expected === '') {
    return createMiddleware<AppEnv>(async (_, next) => {
      await next()
    })
  }

  return createMiddleware<AppEnv>(async (c, next) => {
    // Readiness probe stays open so orchestrators can route on health.
    if (c.req.path === HEALTH_PATH) {
      await next()
      return
    }
    const provided = extractKey(c.req.raw.headers)
    if (!provided || !safeEqual(provided, expected)) {
      return c.json({ error: 'Missing or invalid API key', code: ERROR_CODE.UNAUTHORIZED }, 401)
    }
    await next()
  })
}
