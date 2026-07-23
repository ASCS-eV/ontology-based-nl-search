import { BackendCapabilityError } from '@ontology-search/core/errors'
import { describe, expect, it } from 'vitest'

import type { AuthoringBackend, EngineInfo } from '../backend.js'
import { EXPECTED_ENGINE, probeEngineVersions } from '../capability-probe.js'
import { NullAuthoringBackend } from '../null-backend.js'
import { WasmAuthoringBackend } from '../wasm-backend.js'

/** A minimal stub backend that reports a fixed capability set. */
function fakeBackend(describe: () => Promise<EngineInfo>): AuthoringBackend {
  return {
    describe,
    validate: () => Promise.resolve({ ok: false, diagnostics: [] }),
    isReady: () => Promise.resolve(false),
  }
}

describe('probeEngineVersions', () => {
  it('passes for the real WASM engine against EXPECTED_ENGINE', async () => {
    const backend = new WasmAuthoringBackend()
    await expect(probeEngineVersions(backend, EXPECTED_ENGINE)).resolves.toBeUndefined()
    await backend.close()
  })

  it('throws BackendCapabilityError on version drift (empty versions)', async () => {
    // The null backend reports no versions — a deliberate mismatch.
    await expect(
      probeEngineVersions(new NullAuthoringBackend(), EXPECTED_ENGINE)
    ).rejects.toBeInstanceOf(BackendCapabilityError)
  })

  it('throws BackendCapabilityError when describe() itself fails', async () => {
    const broken = fakeBackend(() => Promise.reject(new Error('boom')))
    await expect(probeEngineVersions(broken, EXPECTED_ENGINE)).rejects.toThrow(/did not report/i)
  })

  it('reports the specific mismatched OSC version', async () => {
    const wrong = fakeBackend(() =>
      Promise.resolve({ engine: 'x', engineCommit: '292d0be', oscVersions: ['1.2'], xsd: '1.3.0' })
    )
    await expect(probeEngineVersions(wrong, EXPECTED_ENGINE)).rejects.toThrow(/1\.3/)
  })

  it('reports an XSD version mismatch', async () => {
    const wrong = fakeBackend(() =>
      Promise.resolve({ engine: 'x', engineCommit: '292d0be', oscVersions: ['1.3'], xsd: '1.2.0' })
    )
    await expect(probeEngineVersions(wrong, EXPECTED_ENGINE)).rejects.toThrow(/XSD/i)
  })

  it('reports an engine-commit mismatch when a commit is pinned', async () => {
    const wrong = fakeBackend(() =>
      Promise.resolve({ engine: 'x', engineCommit: 'deadbee', oscVersions: ['1.3'], xsd: '1.3.0' })
    )
    await expect(probeEngineVersions(wrong, EXPECTED_ENGINE)).rejects.toThrow(/commit/i)
  })

  it('ignores the engine commit when the expectation does not pin one', async () => {
    const backend = fakeBackend(() =>
      Promise.resolve({ engine: 'x', engineCommit: 'whatever', oscVersions: ['1.3'], xsd: '1.3.0' })
    )
    await expect(
      probeEngineVersions(backend, { oscVersions: ['1.3'], xsd: '1.3.0' })
    ).resolves.toBeUndefined()
  })
})
