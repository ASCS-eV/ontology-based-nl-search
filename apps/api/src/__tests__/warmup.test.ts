import { getAuthoringBackend, probeEngineVersions } from '@ontology-search/authoring'
import { getConfig } from '@ontology-search/core/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { probeAuthoring } from '../warmup.js'

// Mock every workspace dep warmup.ts imports so importing it is cheap and
// `probeAuthoring` exercises only the authoring-probe path (config + backend).
vi.mock('@ontology-search/core/config', () => ({ getConfig: vi.fn() }))
vi.mock('@ontology-search/authoring', () => ({
  getAuthoringBackend: vi.fn(),
  probeEngineVersions: vi.fn(),
}))
vi.mock('@ontology-search/llm', () => ({ warmupAgentPrompt: vi.fn(), warmupLlmSession: vi.fn() }))
vi.mock('@ontology-search/ontology/domain-registry', () => ({ buildDomainRegistry: vi.fn() }))
vi.mock('@ontology-search/ontology/shacl-validator', () => ({
  ShaclValidator: { fromWorkspace: vi.fn() },
}))
vi.mock('@ontology-search/search', () => ({
  getInitializedStore: vi.fn(),
  warmupCompiler: vi.fn(),
}))
vi.mock('@ontology-search/sparql', () => ({ probePropertyPathSupport: vi.fn() }))
vi.mock('@ontology-search/sparql/policy', () => ({ registerPolicyNamespaces: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getConfig).mockReturnValue({ AUTHORING_MODE: 'wasm' } as never)
})

describe('probeAuthoring (authoring engine capability probe at warmup)', () => {
  /**
   * The regression this wiring closes: before it, nothing probed the engine at
   * startup, so an artifact built for the wrong OpenSCENARIO/XSD version would
   * author silently non-conformant `.xosc`. probeAuthoring must surface that as
   * a thrown error (which `runStep` records → /health degraded).
   */
  it('throws when the engine mismatches the version pin', async () => {
    const backend = { describe: vi.fn() }
    vi.mocked(getAuthoringBackend).mockReturnValue(backend as never)
    // probeEngineVersions owns describe() + the comparison; on a mismatch it
    // rejects with BackendCapabilityError.
    vi.mocked(probeEngineVersions).mockRejectedValue(
      new Error('XSD version "1.2.0" != expected "1.3.0"')
    )

    await expect(probeAuthoring()).rejects.toThrow(/XSD version/)
    expect(probeEngineVersions).toHaveBeenCalledOnce()
    expect(probeEngineVersions).toHaveBeenCalledWith(backend)
  })

  it('skips the probe entirely when AUTHORING_MODE=null', async () => {
    vi.mocked(getConfig).mockReturnValue({ AUTHORING_MODE: 'null' } as never)
    await expect(probeAuthoring()).resolves.toBeUndefined()
    expect(getAuthoringBackend).not.toHaveBeenCalled()
    expect(probeEngineVersions).not.toHaveBeenCalled()
  })

  it('resolves when the engine matches the pin', async () => {
    const backend = { describe: vi.fn() }
    vi.mocked(getAuthoringBackend).mockReturnValue(backend as never)
    vi.mocked(probeEngineVersions).mockResolvedValue(undefined)

    await expect(probeAuthoring()).resolves.toBeUndefined()
    expect(probeEngineVersions).toHaveBeenCalledWith(backend)
  })
})
