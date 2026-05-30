/**
 * Worker-based Oxigraph Store — non-blocking SparqlStore using worker_threads.
 *
 * Proxies all Oxigraph operations to a dedicated worker thread via message
 * passing. This prevents synchronous WASM query execution from blocking the
 * Node.js event loop, allowing the API server to handle concurrent requests
 * without head-of-line blocking.
 *
 * **Architecture:**
 * - Each WorkerOxigraphStore owns one Worker thread
 * - Operations are serialized as messages with unique request IDs
 * - Responses are matched to pending Promises by ID
 * - AbortSignal is honoured at the main-thread boundary (before send and
 *   racing the response) — the worker cannot be interrupted mid-WASM-call
 *
 * **Lifecycle:**
 * - Worker is spawned lazily on first `initialize()` call
 * - Use `terminate()` for graceful shutdown
 *
 * @see packages/sparql/src/oxigraph-worker.ts — worker script
 * @see packages/sparql/src/oxigraph-store.ts  — direct (blocking) variant
 */

import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'

import type { WorkerResponse } from './oxigraph-worker.js'
import type { SparqlQueryOptions, SparqlResults, SparqlStore } from './types.js'

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
}

/**
 * Resolve the worker script path.
 *
 * In the built output (`dist/`), the compiled JS is a sibling file.
 * In dev/test (running from `src/`), the .js file doesn't exist —
 * fall back to the .ts source and register tsx as a loader so the
 * worker thread can execute TypeScript directly.
 */
function resolveWorkerPath(): { path: string; execArgv: string[] } {
  const jsPath = fileURLToPath(new URL('./oxigraph-worker.js', import.meta.url))
  if (existsSync(jsPath)) {
    return { path: jsPath, execArgv: [] }
  }

  // TypeScript source (dev/test) — use tsx loader
  const tsPath = fileURLToPath(new URL('./oxigraph-worker.ts', import.meta.url))
  return { path: tsPath, execArgv: ['--import', 'tsx'] }
}

export class WorkerOxigraphStore implements SparqlStore {
  private worker: Worker | null = null
  private ready = false

  /** Pending requests awaiting worker responses, keyed by request ID. */
  private readonly pending = new Map<
    string,
    { resolve: (data: unknown) => void; reject: (err: Error) => void }
  >()

  /**
   * Send a message to the worker and return a Promise that resolves when
   * the worker posts back a matching response. The AbortSignal is raced
   * against the worker's response — if the signal fires first, the pending
   * entry is cleaned up and the Promise rejects with AbortError.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private send(msg: Record<string, any>, signal?: AbortSignal): Promise<unknown> {
    throwIfAborted(signal)

    const id = randomUUID()
    const fullMsg = { ...msg, id }

    return new Promise<unknown>((resolve, reject) => {
      const cleanup = () => {
        this.pending.delete(id)
        signal?.removeEventListener('abort', onAbort)
      }

      const onAbort = () => {
        cleanup()
        reject(new DOMException('Aborted', 'AbortError'))
      }

      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }

      signal?.addEventListener('abort', onAbort, { once: true })

      this.pending.set(id, {
        resolve: (data) => {
          cleanup()
          resolve(data)
        },
        reject: (err) => {
          cleanup()
          reject(err)
        },
      })

      this.worker!.postMessage(fullMsg)
    })
  }

  /** Handle a response from the worker thread. */
  private onMessage(msg: WorkerResponse): void {
    const entry = this.pending.get(msg.id)
    if (!entry) return // Stale or aborted response — discard

    if (msg.type === 'error') {
      entry.reject(new Error(msg.message))
    } else if (msg.type === 'result') {
      entry.resolve(msg.data)
    } else {
      // 'ready' response
      entry.resolve(null)
    }
  }

  /** Handle the worker thread exiting unexpectedly. */
  private onExit(code: number): void {
    const err = new Error(`Oxigraph worker exited with code ${code}`)
    for (const entry of this.pending.values()) {
      entry.reject(err)
    }
    this.pending.clear()
    this.worker = null
    this.ready = false
  }

  async initialize(): Promise<void> {
    if (this.ready) return

    if (!this.worker) {
      const { path, execArgv } = resolveWorkerPath()
      this.worker = new Worker(path, { execArgv })
      this.worker.on('message', (msg: WorkerResponse) => this.onMessage(msg))
      this.worker.on('error', (err: Error) => {
        // Reject all pending and reset
        for (const entry of this.pending.values()) {
          entry.reject(err)
        }
        this.pending.clear()
        this.worker = null
        this.ready = false
      })
      this.worker.on('exit', (code) => this.onExit(code))
    }

    await this.send({ type: 'init' })
    this.ready = true
  }

  async isReady(): Promise<boolean> {
    return this.ready
  }

  async query(sparql: string, options?: SparqlQueryOptions): Promise<SparqlResults> {
    throwIfAborted(options?.signal)
    await this.initialize()
    const data = await this.send({ type: 'query', sparql }, options?.signal)
    return data as SparqlResults
  }

  async update(sparql: string): Promise<void> {
    await this.initialize()
    await this.send({ type: 'update', sparql })
  }

  async loadTurtle(data: string, graphUri?: string): Promise<void> {
    await this.initialize()
    await this.send({ type: 'loadTurtle', data, graphUri })
  }

  async loadJsonLd(data: string, graphUri?: string): Promise<void> {
    await this.initialize()
    await this.send({ type: 'loadJsonLd', data, graphUri })
  }

  /**
   * Terminate the worker thread gracefully.
   * Any pending operations are rejected. Idempotent.
   */
  async terminate(): Promise<void> {
    if (!this.worker) return
    // Detach the exit handler before we tear the worker down: the
    // graceful `terminate` below fires an `exit` event, and `onExit`
    // would otherwise reject any (already-settled) pending entries and
    // log a spurious "worker exited" during normal shutdown.
    this.worker.removeAllListeners('exit')
    try {
      await this.send({ type: 'terminate' })
    } catch {
      // Worker may already be dead — that's fine
    }
    await this.worker?.terminate()
    this.worker = null
    this.ready = false
  }

  /**
   * SparqlStore lifecycle hook — releases the worker thread so the host
   * process can exit. Alias for {@link terminate}; the interface uses
   * the generic name `close` while the worker-specific verb stays for
   * call sites that already use it.
   */
  async close(): Promise<void> {
    await this.terminate()
  }
}
