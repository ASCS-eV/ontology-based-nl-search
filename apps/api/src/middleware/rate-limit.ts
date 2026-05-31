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
 * The bucket store is an LRU cache bounded at `MAX_RATE_LIMIT_BUCKETS`
 * entries (criterion 19): when the bound is reached the least-recently-used
 * client's bucket is evicted, so a flood of distinct — or spoofed
 * `x-forwarded-for` — client keys cannot grow the map without bound
 * (a memory-exhaustion DoS the previous unbounded `Map` was open to; its
 * doc-comment claimed a "pruned on miss-after-refill" sweep that did not
 * exist). An evicted idle client simply gets a fresh burst on its next
 * request, which is correct since it has been idle.
 *
 * Pass `RATE_LIMIT_RPS=0` to disable entirely — `rateLimit()` returns
 * a passthrough middleware in that case.
 *
 * @see https://en.wikipedia.org/wiki/Token_bucket
 */
import { LruCache } from '@ontology-search/core/cache/lru'
import { createMiddleware } from 'hono/factory'

import type { AppEnv } from '../types.js'

/** Hard cap on retained per-client buckets before LRU eviction. */
const MAX_RATE_LIMIT_BUCKETS = 10_000

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
  /**
   * Maximum number of per-client buckets retained before LRU eviction.
   * Bounds memory under a flood of distinct/spoofed client keys.
   * Defaults to {@link MAX_RATE_LIMIT_BUCKETS}.
   */
  maxBuckets?: number
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
  // LRU-bounded so distinct/spoofed client keys can't grow memory without
  // bound. No ttlMs — buckets live until evicted by capacity pressure.
  const buckets = new LruCache<string, Bucket>({
    maxSize: options.maxBuckets ?? MAX_RATE_LIMIT_BUCKETS,
  })

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
