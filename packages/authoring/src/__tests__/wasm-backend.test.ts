import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

import { WasmAuthoringBackend } from '../wasm-backend.js'

const cutIn = readFileSync(
  fileURLToPath(new URL('./fixtures/cut-in.xosc', import.meta.url)),
  'utf8'
)

// The real WASM engine is load-bearing: it is the only structural validator
// (there is no independent XSD engine), so this golden-conformance suite loads
// the actual osc-engine.wasm and asserts its verdicts.
describe('WasmAuthoringBackend (golden conformance, real WASM)', () => {
  const backend = new WasmAuthoringBackend()

  afterAll(async () => {
    await backend.close()
  })

  it('reports the engine, OSC version and XSD version', async () => {
    const info = await backend.describe()
    expect(info.engine).toContain('openscenario.api.test')
    expect(info.oscVersions).toContain('1.3')
    expect(info.xsd).toBe('1.3.0')
  })

  it('isReady() flips false → true on first use and back to false after close()', async () => {
    const fresh = new WasmAuthoringBackend()
    expect(await fresh.isReady()).toBe(false)
    await fresh.describe()
    expect(await fresh.isReady()).toBe(true)
    await fresh.close()
    expect(await fresh.isReady()).toBe(false)
  })

  it('accepts the known-good cut-in scenario', async () => {
    const result = await backend.validate(cutIn)
    expect(result.ok).toBe(true)
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('rejects a known-bad scenario with a located diagnostic (gate has teeth)', async () => {
    const bad = cutIn.replace('dynamicsShape="step"', 'dynamicsShape="bogus"')
    const result = await backend.validate(bad)
    expect(result.ok).toBe(false)
    const err = result.diagnostics.find((d) => d.severity === 'error')
    expect(err).toBeDefined()
    expect(err?.line).toBeGreaterThan(0)
    // The internal MEMFS working path must never leak into a diagnostic.
    expect(err?.message).not.toContain('/work/')
  })

  it('honours an already-aborted signal before dispatch', async () => {
    await expect(backend.validate(cutIn, { signal: AbortSignal.abort() })).rejects.toThrow(/abort/i)
  })

  it('is deterministic across repeated validations', async () => {
    const a = await backend.validate(cutIn)
    const b = await backend.validate(cutIn)
    expect(a).toEqual(b)
  })
})
