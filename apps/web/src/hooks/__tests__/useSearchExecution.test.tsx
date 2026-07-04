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
})
