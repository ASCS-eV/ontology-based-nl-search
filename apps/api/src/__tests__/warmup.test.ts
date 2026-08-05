import { getAuthoringBackend, probeEngineVersions } from '@ontology-search/authoring'
import { getConfig } from '@ontology-search/core/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { probeAuthoring, warmup } from '../warmup.js'

// Mock every workspace dep warmup.ts imports so importing it is cheap and
// `probeAuthoring` exercises only the authoring-probe path (config + backend).
vi.mock('@ontology-search/core/config', () => ({ getConfig: vi.fn() }))
vi.mock('@ontology-search/authoring', () => ({
  getAuthoringBackend: vi.fn(),
  probeEngineVersions: vi.fn(),
}))
vi.mock('@ontology-search/llm', () => ({
  verifyLlmProvider: vi.fn(),
  warmupAgentPrompt: vi.fn(),
  warmupLlmSession: vi.fn(),
}))
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

describe('warmup severity', () => {
  /**
   * An unreachable LLM provider stops natural-language search but nothing
   * else: /stats, /vocabulary and slot-based refinement still answer, and the
   * provider can return without restarting the process. Reporting it as
   * unready would take a working instance out of rotation — and would leave
   * /health permanently 503 for anything (an orchestrator, Playwright) waiting
   * on it. It must be reported, and it must not be fatal.
   */
  /** Every other step succeeding, so the assertions isolate the step under test. */
  async function stubHealthyWarmup(): Promise<void> {
    const { buildDomainRegistry } = await import('@ontology-search/ontology/domain-registry')
    vi.mocked(buildDomainRegistry).mockResolvedValue({
      getAllNamespaces: () => ({}),
    } as never)
    vi.mocked(getAuthoringBackend).mockReturnValue({ describe: vi.fn() } as never)
    vi.mocked(probeEngineVersions).mockResolvedValue(undefined)
  }

  it('records an unavailable provider as a warning, staying ready', async () => {
    await stubHealthyWarmup()
    const { verifyLlmProvider } = await import('@ontology-search/llm')
    vi.mocked(verifyLlmProvider).mockRejectedValue(
      new Error(
        'Ollama is not reachable at http://localhost:11434/v1. Start it with `ollama serve`.'
      )
    )
    const result = await warmup()

    expect(result.errors).toEqual([])
    expect(result.ready).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('ollama serve')
    // Worded as tolerated, not as broken — the service is still serving.
    expect(result.warnings[0]).toContain('LLM provider access unavailable')
    expect(result.warnings[0]).not.toContain('failed')
  })

  /**
   * The opposite case: a store or ontology failure is not recoverable without
   * a restart and breaks every route, so it stays fatal.
   */
  it('keeps a store failure fatal', async () => {
    await stubHealthyWarmup()
    const { getInitializedStore } = await import('@ontology-search/search')
    vi.mocked(getInitializedStore).mockRejectedValue(new Error('no ontology shape files found'))

    const result = await warmup()

    expect(result.ready).toBe(false)
    expect(result.errors.join('\n')).toContain('no ontology shape files found')
  })
})
