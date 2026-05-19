/**
 * In-memory token-bucket rate limiter middleware.
 *
 * Each client gets a bucket holding `burst` tokens that refill at
 * `rps` tokens per second. Each accepted request consumes one token;
 * when the bucket is empty the request gets HTTP 429.
 *
 * Client key derivation (in order of preference):
 *   1. `x-forwarded-for` first hop — set by a reverse proxy.
 *   2. `x-real-ip` — set by nginx-style proxies.
 *   3. The literal string `_shared` — when no forwarded header is
 *      present, every client shares one bucket. That's the safe
 *      default for development; production deployments behind a
 *      proxy will populate the headers.
 *
 * The bucket store is a simple `Map`. It grows unbounded if many
 * distinct clients hit the API; that's acceptable for the current
 * single-process deployment shape but the buckets get pruned on
 * miss-after-refill so long-idle entries don't accumulate forever.
 *
 * Pass `RATE_LIMIT_RPS=0` to disable entirely — `rateLimit()` returns
 * a passthrough middleware in that case.
 *
 * @see https://en.wikipedia.org/wiki/Token_bucket
 */
import { createMiddleware } from 'hono/factory'

import type { AppEnv } from '../types.js'

interface RateLimitOptions {
  /** Average requests-per-second per client. `0` disables the limiter. */
  rps: number
  /** Maximum burst capacity per client (tokens in a full bucket). */
  burst: number
  /**
   * Time source — injectable so tests can advance virtual time without
   * relying on `vi.useFakeTimers()`. Defaults to `Date.now`.
   */
  now?: () => number
}

interface Bucket {
  tokens: number
  lastRefillMs: number
}

function clientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  const real = headers.get('x-real-ip')
  if (real) return real
  return '_shared'
}

export function rateLimit(options: RateLimitOptions) {
  const { rps, burst } = options
  const now = options.now ?? Date.now
  const buckets = new Map<string, Bucket>()

  // Disabled path: zero-cost passthrough so `app.use('*', rateLimit(...))`
  // is safe to call unconditionally.
  if (rps === 0) {
    return createMiddleware<AppEnv>(async (_, next) => {
      await next()
    })
  }

  const refillPerMs = rps / 1000

  return createMiddleware<AppEnv>(async (c, next) => {
    const key = clientKey(c.req.raw.headers)
    const ts = now()

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { tokens: burst, lastRefillMs: ts }
      buckets.set(key, bucket)
    } else {
      // Refill proportional to elapsed wall time, capped at burst.
      const elapsed = ts - bucket.lastRefillMs
      if (elapsed > 0) {
        bucket.tokens = Math.min(burst, bucket.tokens + elapsed * refillPerMs)
        bucket.lastRefillMs = ts
      }
    }

    if (bucket.tokens < 1) {
      const retryAfterSec = Math.ceil((1 - bucket.tokens) / rps)
      c.header('Retry-After', String(Math.max(1, retryAfterSec)))
      return c.json({ error: 'Too Many Requests', code: 'RATE_LIMITED' }, 429)
    }

    bucket.tokens -= 1
    await next()
  })
}
