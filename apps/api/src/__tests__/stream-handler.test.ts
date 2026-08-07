/**
 * Contract tests for the shared SSE route helper.
 *
 * `/search/stream` and `/author/stream` previously carried their own copies of
 * this lifecycle — abort composition, body parsing, query validation, and the
 * abort-vs-failure distinction. Only the search copy was ever tested; the
 * authoring copy's validation had no coverage at all, which is exactly how two
 * copies of a rule drift. Testing the helper once covers both routes.
 *
 * The helper is exercised through a real Hono app so the assertions run against
 * genuine SSE frames, parsed with the same `collectSSEEvents` the web client
 * uses.
 */
import { badRequest } from '@ontology-search/core/errors'
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { collectSSEEvents } from '@ontology-search/core/sse/parser'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { requestId } from '../middleware/request-id.js'
import { handleStreamRoute, type StreamRouteOptions } from '../routes/stream-handler.js'
import type { AppEnv } from '../types.js'

/** Mount the helper with the given options and POST `body` to it. */
async function run<T>(options: Partial<StreamRouteOptions<T>>, body: unknown) {
  const app = new Hono<AppEnv>()
  app.use('*', requestId())
  app.post('/s', (c) =>
    handleStreamRoute<T>(c, {
      label: 'Test stream',
      errorMessage: 'Test failed',
      handler: async () => {},
      ...options,
    } as StreamRouteOptions<T>)
  )
  const res = await app.request('/s', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return collectSSEEvents(res.body!)
}

/** The error payload of the first event, when it is an `error` event. */
function firstErrorMessage(events: Awaited<ReturnType<typeof run>>): string {
  expect(events[0]?.event).toBe(SSE_EVENT.ERROR)
  return JSON.stringify(events[0]?.data)
}

describe('handleStreamRoute — request validation', () => {
  it('rejects a malformed JSON body without running the handler', async () => {
    const handler = vi.fn()
    const events = await run({ handler }, '{not json')
    expect(firstErrorMessage(events)).toMatch(/invalid json/i)
    expect(handler).not.toHaveBeenCalled()
  })

  it.each([
    ['missing query', {}],
    ['non-string query', { query: 42 }],
    ['empty query', { query: '' }],
  ])('rejects %s without running the handler', async (_label, body) => {
    const handler = vi.fn()
    const events = await run({ handler }, body)
    expect(firstErrorMessage(events)).toMatch(/query/i)
    expect(handler).not.toHaveBeenCalled()
  })

  /**
   * The cap exists so an over-long prompt cannot reach the LLM. Asserting the
   * handler never ran is the part that matters — an error event emitted
   * *after* the work was done would not protect anything.
   */
  it('rejects an over-long query before the handler runs', async () => {
    const handler = vi.fn()
    const events = await run({ handler }, { query: 'x'.repeat(50_000) })
    expect(firstErrorMessage(events)).toMatch(/too long/i)
    expect(handler).not.toHaveBeenCalled()
  })

  it('passes a valid query through to the handler and streams what it emits', async () => {
    let seenQuery: string | undefined
    const events = await run(
      {
        handler: async ({ query, emit }) => {
          seenQuery = query
          await emit(SSE_EVENT.STATUS, { phase: 'executing' })
          await emit(SSE_EVENT.DONE, {})
        },
      },
      { query: 'hello' }
    )
    expect(seenQuery).toBe('hello')
    expect(events.map((e) => e.event)).toEqual([SSE_EVENT.STATUS, SSE_EVENT.DONE])
  })
})

describe('handleStreamRoute — endpoint-specific fields', () => {
  it('surfaces a parseBody rejection as an error event and skips the handler', async () => {
    const handler = vi.fn()
    const events = await run<{ archetype?: string }>(
      {
        handler,
        parseBody: (raw) =>
          typeof raw['archetype'] === 'string' || raw['archetype'] === undefined
            ? { archetype: raw['archetype'] as string | undefined }
            : badRequest('"archetype" must be a string'),
      },
      { query: 'q', archetype: 99 }
    )
    expect(firstErrorMessage(events)).toMatch(/archetype/i)
    expect(handler).not.toHaveBeenCalled()
  })

  it('hands the parsed extra fields to the handler', async () => {
    let seen: unknown
    await run<{ archetype?: string }>(
      {
        parseBody: (raw) => ({ archetype: raw['archetype'] as string | undefined }),
        handler: async ({ body }) => {
          seen = body
        },
      },
      { query: 'q', archetype: 'cut-in' }
    )
    expect(seen).toEqual({ archetype: 'cut-in' })
  })
})

describe('handleStreamRoute — failure handling', () => {
  it('emits an error event carrying the endpoint message when the handler throws', async () => {
    const events = await run(
      {
        errorMessage: 'Authoring failed',
        handler: async () => {
          throw new Error('boom')
        },
      },
      { query: 'q' }
    )
    expect(firstErrorMessage(events)).toMatch(/authoring failed/i)
  })

  /**
   * A client-side abort is not a server failure. Emitting an error event here
   * would be writing to a stream nobody is reading, and would log the routine
   * case as a fault.
   */
  it('stays silent when the handler aborts', async () => {
    const events = await run(
      {
        handler: async () => {
          throw new DOMException('Aborted', 'AbortError')
        },
      },
      { query: 'q' }
    )
    expect(events.filter((e) => e.event === SSE_EVENT.ERROR)).toEqual([])
  })
})

describe('handleStreamRoute — cancellation', () => {
  /**
   * Both endpoints drive long-running LLM work off this signal. If it did not
   * fire on client disconnect, an abandoned request would keep burning tokens
   * and store queries to produce results nobody will read.
   */
  it('aborts the handler signal when the request is already aborted', async () => {
    const app = new Hono<AppEnv>()
    app.use('*', requestId())
    let observed: boolean | undefined
    app.post('/s', (c) =>
      handleStreamRoute(c, {
        label: 'Test stream',
        errorMessage: 'Test failed',
        handler: async ({ signal }) => {
          observed = signal.aborted
        },
      })
    )

    const controller = new AbortController()
    controller.abort()
    const res = await app.request('/s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'q' }),
      signal: controller.signal,
    })
    await collectSSEEvents(res.body!)

    expect(observed).toBe(true)
  })
})
