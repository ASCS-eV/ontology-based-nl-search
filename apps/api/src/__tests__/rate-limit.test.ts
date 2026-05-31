/**
 * Token-bucket rate-limit middleware tests.
 *
 * The middleware lives outside the main Hono app so we can mount it
 * on a fresh test app with a controllable clock. Real time would
 * make the burst / refill behaviour non-deterministic.
 */
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'

import { rateLimit } from '../middleware/rate-limit.js'
import type { AppEnv } from '../types.js'

let virtualNowMs = 0
const now = () => virtualNowMs

function buildApp(rps: number, burst: number) {
  const app = new Hono<AppEnv>()
  app.use('*', rateLimit({ rps, burst, now }))
  app.get('/ok', (c) => c.json({ ok: true }))
  return app
}

async function get(app: Hono<AppEnv>, ip: string) {
  return app.request('/ok', { headers: { 'x-forwarded-for': ip } })
}

beforeEach(() => {
  virtualNowMs = 0
})

describe('rateLimit middleware', () => {
  /**
   * With RPS=5 and BURST=5, the 6th request from one client within
   * the same virtual instant must be rejected — the bucket holds
   * exactly 5 tokens and refill is too slow to matter at 0 ms.
   */
  it('returns 429 once the burst is exhausted', async () => {
    const app = buildApp(5, 5)
    const ip = '203.0.113.10'

    for (let i = 0; i < 5; i++) {
      const res = await get(app, ip)
      expect(res.status).toBe(200)
    }

    const limited = await get(app, ip)
    expect(limited.status).toBe(429)
    const body = (await limited.json()) as { code: string }
    expect(body.code).toBe('RATE_LIMITED')
    expect(limited.headers.get('Retry-After')).toBeTruthy()
  })

  /**
   * Tokens refill linearly. With RPS=5, one full token takes 200 ms.
   * After exhausting the burst, advancing 200 ms must give exactly
   * one new request through.
   */
  it('refills tokens over time at the configured RPS', async () => {
    const app = buildApp(5, 5)
    const ip = '203.0.113.11'

    for (let i = 0; i < 5; i++) await get(app, ip)
    expect((await get(app, ip)).status).toBe(429)

    // Advance virtual clock 200 ms — one token refilled.
    virtualNowMs += 200
    expect((await get(app, ip)).status).toBe(200)
    // Still no more tokens available immediately after.
    expect((await get(app, ip)).status).toBe(429)
  })

  /**
   * Clients are isolated by their forwarded IP. One IP exhausting
   * its bucket must not affect another.
   */
  it('isolates buckets per client IP', async () => {
    const app = buildApp(2, 2)

    for (let i = 0; i < 2; i++) {
      expect((await get(app, '10.0.0.1')).status).toBe(200)
    }
    expect((await get(app, '10.0.0.1')).status).toBe(429)

    // A different IP still has its full bucket.
    expect((await get(app, '10.0.0.2')).status).toBe(200)
    expect((await get(app, '10.0.0.2')).status).toBe(200)
    expect((await get(app, '10.0.0.2')).status).toBe(429)
  })

  /**
   * RPS=0 disables the middleware entirely — no bucket bookkeeping,
   * no 429s. Used as the development default.
   */
  it('is a no-op when rps is 0', async () => {
    const app = buildApp(0, 10)
    for (let i = 0; i < 50; i++) {
      expect((await get(app, '10.0.0.99')).status).toBe(200)
    }
  })

  /**
   * The first IP in `x-forwarded-for` (the originating client per
   * proxy convention) is used; trailing hops don't share the bucket.
   */
  it('uses the first hop from a multi-value x-forwarded-for', async () => {
    const app = buildApp(1, 1)
    const headers = { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' }
    expect((await app.request('/ok', { headers })).status).toBe(200)
    // Second request from the SAME first hop — should be 429.
    expect((await app.request('/ok', { headers })).status).toBe(429)
    // Same downstream-proxy chain but a different originating client —
    // gets its own bucket.
    expect(
      (await app.request('/ok', { headers: { 'x-forwarded-for': '10.0.0.99, 10.0.0.2' } })).status
    ).toBe(200)
  })

  /**
   * Memory-safety regression (criterion 19): the bucket store is LRU-bounded,
   * so a flood of distinct (or spoofed `x-forwarded-for`) client keys evicts
   * the least-recently-used bucket instead of growing forever. With
   * maxBuckets=2, client A's exhausted bucket is evicted once two other
   * clients arrive — so A gets a fresh burst on return (200) rather than the
   * stale 429 the previous unbounded Map would have kept indefinitely.
   */
  it('evicts least-recently-used buckets when the store is full (bounded memory)', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', rateLimit({ rps: 1, burst: 1, now, maxBuckets: 2 }))
    app.get('/ok', (c) => c.json({ ok: true }))

    // A exhausts its single token.
    expect((await get(app, 'A')).status).toBe(200)
    expect((await get(app, 'A')).status).toBe(429)

    // Two more distinct clients push the store past maxBuckets=2, evicting A.
    expect((await get(app, 'B')).status).toBe(200)
    expect((await get(app, 'C')).status).toBe(200)

    // A's stale empty bucket was evicted → fresh burst, not the old 429.
    expect((await get(app, 'A')).status).toBe(200)
  })

  /**
   * Falls back to x-real-ip when x-forwarded-for is absent. Without
   * either, all anonymous clients share the `_shared` bucket — safer
   * fail-closed behaviour than letting un-keyed traffic past.
   */
  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const app = buildApp(1, 1)
    expect((await app.request('/ok', { headers: { 'x-real-ip': '198.51.100.1' } })).status).toBe(
      200
    )
    expect((await app.request('/ok', { headers: { 'x-real-ip': '198.51.100.1' } })).status).toBe(
      429
    )
  })
})
