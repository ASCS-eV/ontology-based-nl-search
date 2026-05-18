/**
 * Pins the API's typed-error → HTTP-status contract.
 *
 * The whole point of the AppError hierarchy is that the wire status is
 * anchored to the class, not the message string. These tests:
 *   1. Mount the real `errorHandler` on a minimal Hono app.
 *   2. Force a route to throw each AppError subclass.
 *   3. Assert the response status and `code` match the subclass declaration.
 *
 * If a library reworded one of these errors and the regression hid in
 * message matching, the test that re-instantiates with a different message
 * would still pass — proving the mapping cannot depend on string content.
 */

import {
  AgentError,
  AppError,
  CompileError,
  OntologySourcesError,
  StoreUnavailableError,
} from '@ontology-search/core/errors'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { errorHandler } from '../middleware/error-handler.js'
import type { AppEnv } from '../types.js'

function buildApp(make: () => Error) {
  const app = new Hono<AppEnv>()
  app.use('*', async (c, next) => {
    c.set('requestId', 'test-req')
    await next()
  })
  app.get('/throw', () => {
    throw make()
  })
  app.onError(errorHandler)
  return app
}

describe('errorHandler middleware', () => {
  it.each<{ make: () => AppError; status: number; code: string; label: string }>([
    {
      label: 'CompileError → 422 UNPROCESSABLE_ENTITY',
      make: () => new CompileError('No domains detected'),
      status: 422,
      code: 'UNPROCESSABLE_ENTITY',
    },
    {
      label: 'StoreUnavailableError → 503 SERVICE_UNAVAILABLE',
      make: () => new StoreUnavailableError('endpoint returned 500'),
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    },
    {
      label: 'AgentError → 503 SERVICE_UNAVAILABLE',
      make: () => new AgentError('Claude CLI token expired'),
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    },
    {
      label: 'OntologySourcesError → 503 SERVICE_UNAVAILABLE',
      make: () => new OntologySourcesError('malformed ontology-sources.json'),
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    },
  ])('maps $label', async ({ make, status, code }) => {
    const app = buildApp(make)
    const res = await app.request('/throw')
    expect(res.status).toBe(status)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe(code)
  })

  /**
   * Regression: a library renaming the message MUST NOT change the wire
   * contract. Two CompileErrors with completely different messages must
   * map to the same status and code.
   */
  it('maps by class, not message — renaming a message preserves status', async () => {
    const appA = buildApp(() => new CompileError('Unknown domain: foo'))
    const appB = buildApp(() => new CompileError('completely reworded explanation here'))
    const [resA, resB] = await Promise.all([appA.request('/throw'), appB.request('/throw')])
    expect(resA.status).toBe(resB.status)
    expect(resA.status).toBe(422)
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()])
    expect((bodyA as { code: string }).code).toBe((bodyB as { code: string }).code)
  })

  it('falls through to 500 INTERNAL_ERROR for plain Error', async () => {
    const app = buildApp(() => new Error('something untyped'))
    const res = await app.request('/throw')
    expect(res.status).toBe(500)
    const body = (await res.json()) as { code: string; error: string }
    expect(body.code).toBe('INTERNAL_ERROR')
    // The plain message must never leak to the client.
    expect(body.error).not.toContain('something untyped')
  })
})
