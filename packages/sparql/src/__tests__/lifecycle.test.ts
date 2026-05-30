/**
 * Store lifecycle — `close()` releases resources for clean process exit.
 *
 * Regression coverage for the dev/prod shutdown hang: the in-memory
 * worker store spawns a `worker_threads.Worker` that keeps the Node
 * event loop ref'd. Without `close()` terminating it, SIGINT/SIGTERM
 * leaves the process hanging (turbo's "tasks taking awhile to shut
 * down", and stalled container rollouts on SIGTERM).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CachedSparqlStore } from '../cached-store.js'
import { RemoteSparqlStore } from '../remote-store.js'
import type { SparqlStore } from '../types.js'
import { WorkerOxigraphStore } from '../worker-oxigraph-store.js'

describe('WorkerOxigraphStore lifecycle', () => {
  it('close() terminates the worker so it no longer reports ready', async () => {
    const store = new WorkerOxigraphStore()
    await store.query('ASK { ?s ?p ?o }') // forces worker spawn + init
    expect(await store.isReady()).toBe(true)

    await store.close()
    expect(await store.isReady()).toBe(false)
  }, 30_000)

  it('close() is idempotent and safe before any init', async () => {
    const store = new WorkerOxigraphStore()
    // Never initialized — must not throw.
    await expect(store.close()).resolves.toBeUndefined()
    // Double close after use must also be safe.
    await store.query('ASK { ?s ?p ?o }')
    await store.close()
    await expect(store.close()).resolves.toBeUndefined()
  }, 30_000)

  it('a closed worker store re-initializes on next use', async () => {
    const store = new WorkerOxigraphStore()
    await store.loadTurtle('<http://x/a> <http://x/b> <http://x/c> .')
    await store.close()
    // After close, a fresh query must transparently respawn the worker.
    const res = await store.query('SELECT ?s WHERE { ?s ?p ?o }')
    expect(res.results.bindings.length).toBeGreaterThanOrEqual(0)
    await store.close()
  }, 30_000)
})

describe('CachedSparqlStore lifecycle', () => {
  it('close() clears the cache and delegates to the inner store', async () => {
    const inner: SparqlStore & { closed: boolean } = {
      closed: false,
      query: vi.fn().mockResolvedValue({ head: { vars: [] }, results: { bindings: [] } }),
      update: vi.fn().mockResolvedValue(undefined),
      loadTurtle: vi.fn().mockResolvedValue(undefined),
      loadJsonLd: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockImplementation(async function (this: { closed: boolean }) {
        inner.closed = true
      }),
    }
    const cached = new CachedSparqlStore(inner, { maxSize: 10, ttlMs: 1000 })
    await cached.close()
    expect(inner.close).toHaveBeenCalledOnce()
    expect(inner.closed).toBe(true)
  })

  it('close() tolerates an inner store with no close() method', async () => {
    const inner: SparqlStore = {
      query: vi.fn().mockResolvedValue({ head: { vars: [] }, results: { bindings: [] } }),
      update: vi.fn().mockResolvedValue(undefined),
      loadTurtle: vi.fn().mockResolvedValue(undefined),
      loadJsonLd: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockResolvedValue(true),
      // no close
    }
    const cached = new CachedSparqlStore(inner, { maxSize: 10, ttlMs: 1000 })
    await expect(cached.close()).resolves.toBeUndefined()
  })
})

describe('RemoteSparqlStore lifecycle', () => {
  it('close() is a no-op (stateless HTTP client)', async () => {
    const store = new RemoteSparqlStore('http://localhost:3030/ds/sparql')
    await expect(store.close()).resolves.toBeUndefined()
  })
})

describe('closeSparqlStore singleton teardown', () => {
  const originalEnv = process.env
  afterEach(() => {
    process.env = originalEnv
  })

  it('closes the cached singleton and lets a fresh one be built', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test', SPARQL_MODE: 'memory' }
    const { resetConfig } = await import('@ontology-search/core/config')
    resetConfig()
    const { getSparqlStore, closeSparqlStore } = await import('../index.js')

    const first = getSparqlStore()
    await first.query('ASK { ?s ?p ?o }')

    await closeSparqlStore()
    // Idempotent second call.
    await expect(closeSparqlStore()).resolves.toBeUndefined()

    // A new instance is built after teardown.
    const second = getSparqlStore()
    expect(second).not.toBe(first)
    await closeSparqlStore()
  }, 30_000)
})
