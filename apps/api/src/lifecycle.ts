/**
 * Process lifecycle — graceful shutdown orchestration.
 *
 * Extracted from the entrypoint so the drain sequence is unit-testable
 * without spawning a real server (the cold-start + Oxigraph worker make
 * a child-process test slow and flaky). The entrypoint wires this to
 * `process.once('SIGINT'|'SIGTERM', …)`; tests drive it with injected
 * fakes and assert the ordering, the watchdog, and the
 * double-signal escalation.
 *
 * Why this matters beyond dev ergonomics: a process that ignores
 * SIGTERM never drains in-flight requests and never releases the
 * ref'd Oxigraph worker thread, so it hangs `turbo dev` on Ctrl+C and
 * stalls container/orchestrator rollouts (which SIGTERM then SIGKILL
 * after a grace period).
 */
import type { ServerType } from '@hono/node-server'

/** Minimal logger surface the shutdown runner needs. */
export interface ShutdownLogger {
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, error?: unknown, data?: Record<string, unknown>): void
}

export interface ShutdownDeps {
  /** Returns the HTTP listener, or null if `serve()` hasn't run yet. */
  getServer: () => ServerType | null
  /** Release the SPARQL store (terminates the Oxigraph worker thread). */
  closeStore: () => Promise<void>
  /** Release the in-process authoring engine (drops the WASM module refs). */
  closeAuthoring: () => Promise<void>
  log: ShutdownLogger
  /** Process exit — injectable so tests don't kill the runner. */
  exit: (code: number) => void
  /**
   * Hard ceiling on graceful drain. If a step stalls past this, force-
   * exit rather than hang. Default 5s.
   */
  graceMs?: number
}

const DEFAULT_GRACE_MS = 5_000

/**
 * Build a shutdown handler bound to `deps`. The returned function is
 * idempotent-by-escalation: the first call drains; a second concurrent
 * call (impatient double Ctrl+C) forces an immediate non-zero exit.
 *
 * Drain order:
 *   1. stop accepting new connections (`server.close`, if up),
 *   2. release the SPARQL store / worker thread,
 *   3. release the in-process authoring engine,
 *   4. exit 0.
 * A watchdog timer force-exits (code 1) if any async step stalls.
 */
export interface ListenErrorDeps {
  /** The port we tried to bind — surfaced in the EADDRINUSE message. */
  port: number
  log: ShutdownLogger
  /** Process exit — injectable so tests don't kill the runner. */
  exit: (code: number) => void
}

/**
 * Handle a fatal HTTP-server `error` event. The common case is `EADDRINUSE`
 * (the port is already taken — usually a stale or duplicate instance): surface
 * a clear, actionable message and exit non-zero, instead of letting the
 * unhandled `error` event crash the process with a raw stack trace. Returned as
 * a handler so it can be attached to the server `serve()` returns and
 * unit-tested without binding a real socket.
 */
export function createListenErrorHandler(
  deps: ListenErrorDeps
): (err: NodeJS.ErrnoException) => void {
  return (err) => {
    if (err.code === 'EADDRINUSE') {
      deps.log.error(
        `Port ${deps.port} is already in use — another instance may be running. ` +
          `Free it (e.g. \`node scripts/clean-ports.mjs ${deps.port}\`) or set API_PORT to a different port.`,
        err
      )
    } else {
      deps.log.error('HTTP server error', err)
    }
    deps.exit(1)
  }
}

export function createShutdownHandler(deps: ShutdownDeps): (signal: string) => Promise<void> {
  const graceMs = deps.graceMs ?? DEFAULT_GRACE_MS
  let shuttingDown = false

  return async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      deps.log.warn('Second shutdown signal — forcing exit', { signal })
      deps.exit(1)
      return
    }
    shuttingDown = true
    deps.log.info('Shutting down', { signal })

    const watchdog = setTimeout(() => {
      deps.log.error('Graceful shutdown timed out — forcing exit', undefined, { graceMs })
      deps.exit(1)
    }, graceMs)
    // Don't let the watchdog itself keep the event loop alive.
    watchdog.unref?.()

    try {
      const server = deps.getServer()
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
      await deps.closeStore()
      await deps.closeAuthoring()
      clearTimeout(watchdog)
      deps.log.info('Shutdown complete', { signal })
      deps.exit(0)
    } catch (error) {
      clearTimeout(watchdog)
      deps.log.error('Error during shutdown', error)
      deps.exit(1)
    }
  }
}
