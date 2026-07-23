/**
 * `WasmAuthoringBackend` — the default `AuthoringBackend`, backed by the
 * in-process OpenSCENARIO WASM engine (packages/authoring-wasm, task 08).
 *
 * Loads the engine once (lazily, on first use) and calls it in-process, exactly
 * as `WorkerOxigraphStore` loads Oxigraph WASM. Only already-structured data (a
 * `.xosc` string + companion files) crosses the boundary — never LLM free-text
 * — so there is no port, auth or cold-start surface.
 */
import type { AuthoringIR } from '@ontology-search/authoring-ir'
import { loadOscEngine, type OscEngine } from '@ontology-search/authoring-wasm'

import type {
  AuthoringBackend,
  AuthoringLowerOptions,
  AuthoringValidateOptions,
  AuthoringValidationResult,
  EngineInfo,
} from './backend.js'
import { irToEngineTree } from './ir-to-engine.js'

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export class WasmAuthoringBackend implements AuthoringBackend {
  private engine: OscEngine | null = null
  private loading: Promise<OscEngine> | null = null

  /** Load-once memo. On failure the memo is cleared so a later call can retry. */
  private async engineReady(): Promise<OscEngine> {
    if (this.engine) return this.engine
    this.loading ??= loadOscEngine()
    try {
      this.engine = await this.loading
    } catch (err) {
      this.loading = null
      throw err
    }
    this.loading = null
    return this.engine
  }

  async isReady(): Promise<boolean> {
    return this.engine !== null
  }

  async describe(): Promise<EngineInfo> {
    const engine = await this.engineReady()
    return engine.describe()
  }

  async lower(ir: AuthoringIR, options?: AuthoringLowerOptions): Promise<string> {
    throwIfAborted(options?.signal)
    const engine = await this.engineReady()
    // The WASM author call is synchronous and uninterruptible; honour a signal
    // that fired while the engine was loading before we dispatch.
    throwIfAborted(options?.signal)
    return engine.author(irToEngineTree(ir))
  }

  async validate(
    xosc: string,
    options?: AuthoringValidateOptions
  ): Promise<AuthoringValidationResult> {
    throwIfAborted(options?.signal)
    const engine = await this.engineReady()
    // The WASM call is synchronous and cannot be interrupted; honour a signal
    // that fired while the engine was loading before we dispatch.
    throwIfAborted(options?.signal)
    const result = engine.validate(xosc, options?.files)
    return { ok: result.ok, diagnostics: result.diagnostics }
  }

  /**
   * Drop the engine reference so it can be garbage-collected. The Emscripten
   * module holds no worker thread, socket or timer, so it never refs the event
   * loop — dropping the reference is enough for a clean host exit. Idempotent.
   */
  async close(): Promise<void> {
    this.engine = null
    this.loading = null
  }
}
