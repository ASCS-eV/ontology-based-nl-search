/**
 * Graceful-shutdown orchestration tests.
 *
 * Regression coverage for the dev/prod shutdown hang: before this, the
 * API entrypoint registered no SIGINT/SIGTERM handler, so the ref'd
 * Oxigraph worker thread kept the event loop alive and Ctrl+C / SIGTERM
 * hung (turbo "tasks taking awhile to shut down"; stalled container
 * rollouts). These assert the drain ordering, the watchdog, the
 * double-signal escalation, and the pre-`serve()` (null server) window.
 */
import type { ServerType } from '@hono/node-server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createListenErrorHandler,
  createShutdownHandler,
  type ShutdownLogger,
} from '../lifecycle.js'

function fakeLogger(): ShutdownLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

/** A fake @hono/node-server server whose close() invokes its callback. */
function fakeServer(): ServerType & { closed: boolean } {
  const s = {
    closed: false,
    close(cb?: (err?: Error) => void) {
      s.closed = true
      cb?.()
      return s
    },
  }
  return s as unknown as ServerType & { closed: boolean }
}

describe('createShutdownHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('closes the server, then the store, then exits 0 — in that order', async () => {
    const order: string[] = []
    const server = fakeServer()
    const exit = vi.fn()
    const handler = createShutdownHandler({
      getServer: () => server,
      closeStore: vi.fn().mockImplementation(async () => {
        order.push('store')
      }),
      log: fakeLogger(),
      exit: exit as unknown as (code: number) => void,
    })

    // server.close is synchronous in the fake; record it via a spy wrap.
    const origClose = server.close.bind(server)
    server.close = ((cb?: (e?: Error) => void) => {
      order.push('server')
      return origClose(cb)
    }) as ServerType['close']

    await handler('SIGTERM')

    expect(order).toEqual(['server', 'store'])
    expect(server.closed).toBe(true)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('still closes the store and exits 0 when the server is not up yet', async () => {
    const closeStore = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()
    const handler = createShutdownHandler({
      getServer: () => null, // pre-serve() window
      closeStore,
      log: fakeLogger(),
      exit: exit as unknown as (code: number) => void,
    })

    await handler('SIGINT')

    expect(closeStore).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('force-exits 1 when a drain step stalls past the grace window', async () => {
    const exit = vi.fn()
    // closeStore never resolves — simulate a stuck worker.
    const handler = createShutdownHandler({
      getServer: () => null,
      closeStore: () => new Promise<void>(() => {}),
      log: fakeLogger(),
      exit: exit as unknown as (code: number) => void,
      graceMs: 1000,
    })

    void handler('SIGTERM')
    // Nothing fired yet.
    expect(exit).not.toHaveBeenCalled()
    // Advance past the watchdog window.
    await vi.advanceTimersByTimeAsync(1000)
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('escalates a second signal to an immediate force-exit', async () => {
    const exit = vi.fn()
    const handler = createShutdownHandler({
      getServer: () => null,
      // First drain hangs so the second signal can escalate.
      closeStore: () => new Promise<void>(() => {}),
      log: fakeLogger(),
      exit: exit as unknown as (code: number) => void,
      graceMs: 60_000,
    })

    void handler('SIGTERM') // begins draining, hangs on closeStore
    await handler('SIGINT') // second signal
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('exits 1 when server.close throws', async () => {
    const exit = vi.fn()
    const throwingServer = {
      close() {
        throw new Error('close failed')
      },
    } as unknown as ServerType
    const handler = createShutdownHandler({
      getServer: () => throwingServer,
      closeStore: vi.fn().mockResolvedValue(undefined),
      log: fakeLogger(),
      exit: exit as unknown as (code: number) => void,
    })

    await handler('SIGTERM')
    expect(exit).toHaveBeenCalledWith(1)
  })
})

describe('createListenErrorHandler', () => {
  it('reports EADDRINUSE with an actionable message and exits non-zero', () => {
    const log = fakeLogger()
    const exit = vi.fn()
    const handler = createListenErrorHandler({ port: 3003, log, exit })

    handler(Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' }))

    expect(exit).toHaveBeenCalledWith(1)
    const msg = vi.mocked(log.error).mock.calls[0]?.[0] as string
    expect(msg).toContain('3003')
    expect(msg).toMatch(/in use/i)
    expect(msg).toMatch(/clean-ports|API_PORT/) // actionable guidance
  })

  it('exits non-zero on a generic (non-EADDRINUSE) server error', () => {
    const log = fakeLogger()
    const exit = vi.fn()
    createListenErrorHandler({ port: 3003, log, exit })(new Error('boom'))
    expect(exit).toHaveBeenCalledWith(1)
  })
})
