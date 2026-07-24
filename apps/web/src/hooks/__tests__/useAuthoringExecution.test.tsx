/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as api from '../../lib/api-client'
import { useAuthoringExecution } from '../useAuthoringExecution'

/** Builds a real streaming Response so the hook's own SSE-parsing loop runs unmodified. */
function sseResponse(body: string): Response {
  return new Response(body)
}

/** A promise that never settles — models a request that is still in flight. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * A reader whose single `read()` hangs until the test settles it — lets a test
 * hold an author request "in flight" and then deliver a late abort on demand.
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

describe('useAuthoringExecution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('streams an authoring run to completion, capturing scene, xosc, trace and validity', async () => {
    const stream = [
      'event: status\ndata: {"phase":"authoring","message":"Authoring scene…"}\n\n',
      'event: interpretation\ndata: {"summary":"A cut-in","mappedTerms":[]}\n\n',
      'event: scene\ndata: {"entities":[{"ref":"Ego","type":"Vehicle","properties":{}}],"actions":[]}\n\n',
      'event: xosc\ndata: {"xosc":"<OpenSCENARIO/>"}\n\n',
      'event: gaps\ndata: []\n\n',
      'event: meta\ndata: {"valid":true,"attempts":1,"reportedGaps":[],"trace":[{"gate":"semantic","ok":true,"gapCount":0}]}\n\n',
      'event: done\ndata: {}\n\n',
    ].join('')
    vi.spyOn(api, 'apiPostStream').mockResolvedValue(sseResponse(stream))

    const { result } = renderHook(() => useAuthoringExecution())

    await act(async () => {
      await result.current.handleAuthor('a cut-in on a highway')
    })

    expect(result.current.phase).toBe('done')
    expect(result.current.loading).toBe(false)
    expect(result.current.interpretation?.summary).toBe('A cut-in')
    expect(result.current.scene?.entities[0]?.ref).toBe('Ego')
    expect(result.current.xosc).toBe('<OpenSCENARIO/>')
    expect(result.current.valid).toBe(true)
    expect(result.current.attempts).toBe(1)
    expect(result.current.trace?.[0]?.gate).toBe('semantic')
  })

  it('surfaces an error event without throwing', async () => {
    vi.spyOn(api, 'apiPostStream').mockResolvedValue(
      sseResponse('event: error\ndata: {"message":"Authoring failed"}\n\nevent: done\ndata: {}\n\n')
    )

    const { result } = renderHook(() => useAuthoringExecution())
    await act(async () => {
      await result.current.handleAuthor('nonsense')
    })

    expect(result.current.error).toBe('Authoring failed')
  })

  it('refines an edited IR via the no-LLM path and marks the result read-only xosc', async () => {
    vi.spyOn(api, 'apiPost').mockResolvedValue({
      xosc: '<OpenSCENARIO refined/>',
      valid: true,
      gaps: [],
      trace: [{ gate: 'structural', ok: true, gapCount: 0 }],
    })

    const { result } = renderHook(() => useAuthoringExecution())
    await act(async () => {
      await result.current.handleRefine({ entities: [], actions: [] })
    })

    expect(result.current.xosc).toBe('<OpenSCENARIO refined/>')
    expect(result.current.valid).toBe(true)
    expect(result.current.trace?.[0]?.gate).toBe('structural')
    expect(result.current.phase).toBe('done')
  })

  /**
   * Regression parity with the search hook: a superseded author request must
   * not let its belated abort finalize the state of the request that replaced it.
   */
  it('does not let a superseded author run finalize the state of the run that replaced it', async () => {
    const controllableA = makeControllableReader()
    const spy = vi.spyOn(api, 'apiPostStream')
    spy.mockResolvedValueOnce({
      body: { getReader: () => controllableA.reader },
    } as unknown as Response)
    spy.mockReturnValueOnce(pendingForever<Response>())

    const { result } = renderHook(() => useAuthoringExecution())

    let runA!: Promise<void>
    act(() => {
      runA = result.current.handleAuthor('run A')
    })
    act(() => {
      void result.current.handleAuthor('run B')
    })

    await waitFor(() => expect(result.current.loading).toBe(true))
    expect(result.current.phase).toBe('authoring')

    await act(async () => {
      controllableA.reject(new DOMException('Aborted', 'AbortError'))
      await runA
    })

    // B is still in flight — A's belated finalization must not clobber it.
    expect(result.current.loading).toBe(true)
    expect(result.current.phase).toBe('authoring')
  })
})
