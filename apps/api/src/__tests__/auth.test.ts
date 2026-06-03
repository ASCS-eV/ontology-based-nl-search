/**
 * Optional API-key auth middleware tests.
 *
 * The middleware lives outside the main Hono app so we can mount it on a
 * fresh test app and exercise both the disabled (open) path and the enabled
 * (key-required) path without booting the real server or store.
 */
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { apiKeyAuth } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const KEY = 's3cret-key'

function buildApp(apiKey: string | undefined) {
  const app = new Hono<AppEnv>()
  app.use('*', apiKeyAuth({ apiKey }))
  app.get('/ok', (c) => c.json({ ok: true }))
  // Mirror the real /health route so we can assert it stays open.
  app.get('/health', (c) => c.json({ status: 'ok' }))
  return app
}

describe('apiKeyAuth middleware', () => {
  it('is an open passthrough when API_KEY is unset', async () => {
    const app = buildApp(undefined)
    expect((await app.request('/ok')).status).toBe(200)
  })

  it('is an open passthrough when API_KEY is empty/whitespace', async () => {
    const app = buildApp('   ')
    expect((await app.request('/ok')).status).toBe(200)
  })

  describe('when API_KEY is set', () => {
    it('rejects a request with no credentials (401)', async () => {
      const res = await buildApp(KEY).request('/ok')
      expect(res.status).toBe(401)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe('UNAUTHORIZED')
    })

    it('rejects a wrong key (401)', async () => {
      const res = await buildApp(KEY).request('/ok', {
        headers: { authorization: 'Bearer wrong-key' },
      })
      expect(res.status).toBe(401)
    })

    it('accepts the correct key via Authorization: Bearer', async () => {
      const res = await buildApp(KEY).request('/ok', {
        headers: { authorization: `Bearer ${KEY}` },
      })
      expect(res.status).toBe(200)
    })

    it('accepts the correct key via x-api-key', async () => {
      const res = await buildApp(KEY).request('/ok', { headers: { 'x-api-key': KEY } })
      expect(res.status).toBe(200)
    })

    it('leaves /health open so readiness probes work without the key', async () => {
      const res = await buildApp(KEY).request('/health')
      expect(res.status).toBe(200)
    })

    it('rejects a key that is a length-mismatched prefix of the real key', async () => {
      // Guards the constant-time compare's length short-circuit.
      const res = await buildApp(KEY).request('/ok', {
        headers: { 'x-api-key': KEY.slice(0, 4) },
      })
      expect(res.status).toBe(401)
    })
  })
})
