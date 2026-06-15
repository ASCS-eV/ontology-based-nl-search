/**
 * SSE protocol contract tests for `POST /search/stream`.
 *
 * `routes.test.ts` only asserts status + content-type. These tests parse
 * the actual SSE body and pin the wire contract:
 *
 *   1. The canonical happy-path event order.
 *   2. Each event's `data` is well-formed JSON of the expected shape.
 *   3. `done` is emitted exactly once and is terminal.
 *   4. The failure path emits `event: error` and terminates cleanly.
 *
 * Uses the shared `collectSSEEvents` helper from
 * `@ontology-search/core/sse/parser` so the parser cannot drift between
 * producer (this route) and consumer (the web client).
 */
import { SSE_EVENT } from '@ontology-search/core/sse/events'
import { collectSSEEvents } from '@ontology-search/core/sse/parser'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../app.js'

vi.mock('../search-factory.js', () => ({
  searchNl: vi.fn(),
  searchRefine: vi.fn(),
}))

/**
 * Helper to mock searchNl with onProgress simulation.
 * The route passes onProgress in options; the mock must invoke it
 * so that incremental SSE events are emitted during the test.
 */
function mockSearchNlWithProgress(result: typeof HAPPY_PATH_RESULT) {
  return vi.fn(async (opts: { onProgress?: (p: unknown) => Promise<void> | void }) => {
    if (opts.onProgress) {
      await opts.onProgress({ phase: 'interpreting' })
      await opts.onProgress({
        phase: 'interpreted',
        data: {
          interpretation: result.interpretation,
          gaps: result.gaps,
          sparql: result.sparql,
          slots: { domains: ['hdmap'], filters: {}, ranges: {} },
        },
      })
      await opts.onProgress({ phase: 'executing' })
    }
    return result
  })
}

vi.mock('@ontology-search/search', () => ({
  getInitializedStore: vi.fn(),
  compileCountQuery: vi.fn(),
  getAssetDomains: vi.fn().mockResolvedValue(new Set(['hdmap', 'scenario'])),
  normalizeReferences: (v: unknown) => (!v ? [] : Array.isArray(v) ? v : [v]),
  slotsToGraphQL: () => 'query { }',
}))

vi.mock('@ontology-search/ontology/domain-registry', () => ({
  buildDomainRegistry: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const HAPPY_PATH_RESULT = {
  interpretation: {
    summary: 'find HD maps in Germany',
    mappedTerms: [{ input: 'HD maps', mapped: 'hdmap', confidence: 'high' as const }],
  },
  gaps: [],
  sparql: 'SELECT * WHERE { ?s ?p ?o }',
  execution: { results: [{ asset: 'urn:test:1' }], error: undefined },
  meta: { matchCount: 1, executionTimeMs: 42, requestId: 'req_test', timings: [] },
}

async function postStream(body: unknown) {
  return app.request('/search/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /search/stream — SSE protocol', () => {
  /**
   * The producer's emit order is the contract clients depend on. Re-ordering
   * `interpretation` after `sparql` (for example) would silently break the
   * web UI's phase transitions even though both events still arrive.
   */
  it('emits the canonical event sequence on success', async () => {
    const { searchNl } = await import('../search-factory.js')
    vi.mocked(searchNl).mockImplementation(mockSearchNlWithProgress(HAPPY_PATH_RESULT))

    const res = await postStream({ query: 'find HD maps in Germany' })
    const events = await collectSSEEvents(res.body)
    const sequence = events.map((e) => e.event)

    expect(sequence).toEqual([
      SSE_EVENT.STATUS,
      SSE_EVENT.INTERPRETATION,
      SSE_EVENT.GAPS,
      SSE_EVENT.SPARQL,
      SSE_EVENT.GRAPHQL,
      SSE_EVENT.STATUS,
      SSE_EVENT.RESULTS,
      SSE_EVENT.META,
      SSE_EVENT.DONE,
    ])
  })

  it('emits `done` exactly once and as the terminal event', async () => {
    const { searchNl } = await import('../search-factory.js')
    vi.mocked(searchNl).mockImplementation(mockSearchNlWithProgress(HAPPY_PATH_RESULT))

    const res = await postStream({ query: 'find HD maps in Germany' })
    const events = await collectSSEEvents(res.body)

    const doneIndices = events
      .map((e, i) => (e.event === SSE_EVENT.DONE ? i : -1))
      .filter((i) => i !== -1)
    expect(doneIndices).toHaveLength(1)
    expect(doneIndices[0]).toBe(events.length - 1)
  })

  it("each event's data is well-formed JSON of the expected shape", async () => {
    const { searchNl } = await import('../search-factory.js')
    vi.mocked(searchNl).mockImplementation(mockSearchNlWithProgress(HAPPY_PATH_RESULT))

    const res = await postStream({ query: 'find HD maps in Germany' })
    const events = await collectSSEEvents(res.body)

    const byEvent = new Map(events.map((e) => [e.event, e.data]))

    // status frames carry a phase string
    expect(byEvent.get(SSE_EVENT.STATUS)).toMatchObject({ phase: expect.any(String) })
    // interpretation carries summary + mappedTerms
    expect(byEvent.get(SSE_EVENT.INTERPRETATION)).toMatchObject({
      summary: expect.any(String),
      mappedTerms: expect.any(Array),
    })
    expect(byEvent.get(SSE_EVENT.GAPS)).toEqual([])
    expect(typeof byEvent.get(SSE_EVENT.SPARQL)).toBe('string')
    expect(typeof byEvent.get(SSE_EVENT.GRAPHQL)).toBe('string')
    expect(byEvent.get(SSE_EVENT.RESULTS)).toMatchObject({ results: expect.any(Array) })
    expect(byEvent.get(SSE_EVENT.META)).toMatchObject({ matchCount: expect.any(Number) })
  })

  /**
   * If `searchNl` throws (e.g. CompileError, StoreUnavailableError), the
   * stream must emit `event: error` and terminate cleanly — never leak
   * the inner exception, never half-write a partial event.
   */
  it('emits `event: error` and terminates cleanly when searchNl throws', async () => {
    const { searchNl } = await import('../search-factory.js')
    vi.mocked(searchNl).mockRejectedValue(new Error('upstream failure'))

    const res = await postStream({ query: 'anything' })
    const events = await collectSSEEvents(res.body)

    // First a status frame, then the error. No interpretation/gaps/sparql/etc.
    expect(events.some((e) => e.event === SSE_EVENT.ERROR)).toBe(true)
    expect(events.some((e) => e.event === SSE_EVENT.DONE)).toBe(false)

    const errorEvent = events.find((e) => e.event === SSE_EVENT.ERROR)
    // The error payload exposes a message field but never the inner stack.
    expect(errorEvent?.data).toMatchObject({ message: expect.any(String) })
    expect(JSON.stringify(errorEvent?.data)).not.toContain('upstream failure')
  })

  it('emits a parseable error event when the request body is malformed', async () => {
    const res = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const events = await collectSSEEvents(res.body)

    expect(events).toHaveLength(1)
    expect(events[0]?.event).toBe(SSE_EVENT.ERROR)
    expect(events[0]?.data).toMatchObject({ code: 'BAD_REQUEST' })
  })

  /**
   * The query string is capped (API_MAX_QUERY_CHARS, default 2000) independently
   * of the body-size limit — an over-long query is rejected BEFORE it reaches the
   * LLM, so searchNl is never called.
   */
  it('rejects an over-long query before invoking the LLM', async () => {
    const { searchNl } = await import('../search-factory.js')
    const res = await postStream({ query: 'x'.repeat(2001) })
    const events = await collectSSEEvents(res.body)

    expect(events).toHaveLength(1)
    expect(events[0]?.event).toBe(SSE_EVENT.ERROR)
    expect(events[0]?.data).toMatchObject({ code: 'BAD_REQUEST' })
    expect(JSON.stringify(events[0]?.data)).toMatch(/too long/i)
    expect(searchNl).not.toHaveBeenCalled()
  })
})
