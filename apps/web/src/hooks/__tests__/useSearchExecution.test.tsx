/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../../lib/api-client'
import { useSearchExecution } from '../useSearchExecution'

/** Builds a real streaming Response so the hook's own SSE-parsing loop runs unmodified. */
function sseResponse(body: string): Response {
  return new Response(body)
}

/** A promise that never settles — models a request that is still in flight. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * A `ReadableStreamDefaultReader` stand-in whose single `read()` call hangs
 * until the test explicitly settles it. Lets a test hold a search's stream
 * "in flight" and then deliver a late abort on demand.
 */
function makeControllableReader() {
  let reject!: (reason: unknown) => void
  const pending = new Promise<ReadableStreamReadResult<Uint8Array>>((_resolve, rej) => {
    reject = rej
  })
  return {
    reader: {
      read: () => pending,
      releaseLock: () => {},
    } as unknown as ReadableStreamDefaultReader<Uint8Array>,
    reject: (reason: unknown) => reject(reason),
  }
}

describe('useSearchExecution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('streams a search to completion and reaches phase "done"', async () => {
    vi.spyOn(api, 'apiPostStream').mockResolvedValue(
      sseResponse('event: status\ndata: {"phase":"executing"}\n\nevent: done\ndata: {}\n\n')
    )

    const { result } = renderHook(() => useSearchExecution())

    await act(async () => {
      await result.current.handleSearch('German highways')
    })

    expect(result.current.phase).toBe('done')
    expect(result.current.loading).toBe(false)
  })

  /**
   * Regression: starting search B while search A is still streaming used to
   * abort A's controller, then let A's `finally` unconditionally overwrite
   * shared state with `{ loading: false, phase: 'done' }` once A's aborted
   * `reader.read()` rejected on a later microtask — even though B was still
   * mid-flight. The spinner would vanish and the pipeline would claim "done"
   * while B's results had not arrived yet. `handleSearch` must only let the
   * request that is still current (`abortControllerRef.current === controller`)
   * finalize the shared state.
   */
  it('does not let a superseded search finalize the state of the search that replaced it', async () => {
    const controllableA = makeControllableReader()
    const apiPostStreamSpy = vi.spyOn(api, 'apiPostStream')
    // Search A's stream never delivers a `read()` result until the test
    // rejects it below — A stays "in flight" until then.
    apiPostStreamSpy.mockResolvedValueOnce({
      body: { getReader: () => controllableA.reader },
    } as unknown as Response)
    // Search B's request never resolves in this test — it models B still
    // being mid-flight at the moment A's late abort settles.
    apiPostStreamSpy.mockReturnValueOnce(pendingForever<Response>())

    const { result } = renderHook(() => useSearchExecution())

    let searchA!: Promise<void>
    act(() => {
      searchA = result.current.handleSearch('search A')
    })

    act(() => {
      void result.current.handleSearch('search B')
    })

    await waitFor(() => expect(result.current.loading).toBe(true))
    expect(result.current.phase).toBe('interpreting')

    // A's abort lands late: its pending `reader.read()` rejects with
    // AbortError, mirroring what a real aborted fetch stream does.
    await act(async () => {
      controllableA.reject(new DOMException('Aborted', 'AbortError'))
      await searchA
    })

    // B is still in flight — A's belated finalization must not clobber it.
    expect(result.current.loading).toBe(true)
    expect(result.current.phase).toBe('interpreting')
  })
  /**
   * The defect this change exists to fix. `handleRefine` used to rebuild the
   * slot IR by regex-scraping `interpretation.mappedTerms[].mapped` — a
   * human-readable display string. A multi-valued filter came back as one
   * string, ranges depended on the summary happening to read like ">= 3", and
   * `references` were dropped outright, so a cross-domain query silently
   * became a single-domain one on re-run.
   *
   * The server now streams the validated slots and the client posts exactly
   * what it was given, edits included.
   */
  it('streams the slot IR and refines with it verbatim — arrays, ranges and references intact', async () => {
    const slots = {
      domains: ['hdmap'],
      filters: { roadTypes: ['motorway', 'urban'], country: 'DE' },
      ranges: { laneCount: { min: 3, max: 6 } },
      references: [{ domain: 'ositrace' }],
    }
    vi.spyOn(api, 'apiPostStream').mockResolvedValue(
      sseResponse(`event: slots\ndata: ${JSON.stringify(slots)}\n\nevent: done\ndata: {}\n\n`)
    )
    const apiPost = vi.spyOn(api, 'apiPost').mockResolvedValue({
      sparql: 'SELECT * WHERE {}',
      results: [],
      meta: {},
    } as never)

    const { result } = renderHook(() => useSearchExecution())

    await act(async () => {
      await result.current.handleSearch('German motorways referencing traces')
    })

    // The hook holds the server's own IR, not a reconstruction.
    expect(result.current.slots).toEqual(slots)

    await act(async () => {
      await result.current.handleRefine(result.current.slots!)
    })

    expect(apiPost).toHaveBeenCalledWith('/api/search/refine', { slots })
  })

  it('leaves slots null when the stream carries none', async () => {
    vi.spyOn(api, 'apiPostStream').mockResolvedValue(sseResponse('event: done\ndata: {}\n\n'))
    const { result } = renderHook(() => useSearchExecution())
    await act(async () => {
      await result.current.handleSearch('anything')
    })
    expect(result.current.slots).toBeNull()
  })
  /**
   * Regression: `handleGraphQLRun` did not touch `slots`. Once the refinement
   * panel became the authoritative editable IR, that left it showing the
   * PREVIOUS query's slots after a GraphQL run — and pressing Re-run would
   * execute those instead of the GraphQL the user actually wrote. The endpoint
   * now reports the slots the document parsed to, and the hook adopts them.
   */
  it('adopts the slots a GraphQL run parsed to, replacing the previous search IR', async () => {
    const nlSlots = { domains: ['hdmap'], filters: { country: 'DE' }, ranges: {} }
    const graphqlSlots = { domains: ['ositrace'], filters: { roadTypes: ['urban'] }, ranges: {} }

    vi.spyOn(api, 'apiPostStream').mockResolvedValue(
      sseResponse(`event: slots\ndata: ${JSON.stringify(nlSlots)}\n\nevent: done\ndata: {}\n\n`)
    )
    vi.spyOn(api, 'apiPost').mockResolvedValue({
      sparql: 'SELECT * WHERE {}',
      results: [],
      meta: {},
      slots: graphqlSlots,
    } as never)

    const { result } = renderHook(() => useSearchExecution())
    await act(async () => {
      await result.current.handleSearch('German HD maps')
    })
    expect(result.current.slots).toEqual(nlSlots)

    await act(async () => {
      await result.current.handleGraphQLRun('query { ositrace { roadTypes(values: ["urban"]) } }')
    })

    expect(result.current.slots).toEqual(graphqlSlots)
  })

  /**
   * The server normalizes what it receives (e.g. coerces a single `references`
   * object to an array), so the panel must show what RAN, not what was sent.
   */
  it('adopts the server-normalized slots a refine reports back', async () => {
    vi.spyOn(api, 'apiPostStream').mockResolvedValue(sseResponse('event: done\ndata: {}\n\n'))
    const normalized = {
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      references: [{ domain: 'ositrace' }],
    }
    vi.spyOn(api, 'apiPost').mockResolvedValue({
      sparql: 'SELECT * WHERE {}',
      results: [],
      meta: {},
      slots: normalized,
    } as never)

    const { result } = renderHook(() => useSearchExecution())
    await act(async () => {
      await result.current.handleRefine({ domains: ['hdmap'], filters: {}, ranges: {} })
    })

    expect(result.current.slots).toEqual(normalized)
  })
})
