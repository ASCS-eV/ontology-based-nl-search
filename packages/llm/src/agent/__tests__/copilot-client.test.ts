import type { ModelInfo } from '@github/copilot-sdk'
import { AgentError } from '@ontology-search/core/errors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  starts: 0,
  startError: null as Error | null,
  status: { version: '1.0.85', protocolVersion: 3 },
  listModels: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}))

vi.mock('@github/copilot-sdk', () => ({
  CopilotClient: class {
    async start(): Promise<void> {
      h.starts++
      if (h.startError) throw h.startError
    }
    async getStatus() {
      return h.status
    }
    listModels() {
      return h.listModels()
    }
  },
}))
vi.mock('@ontology-search/core/config', () => ({ getConfig: () => ({}) }))
vi.mock('@ontology-search/core/logging', () => ({ createComponentLogger: () => h.log }))

import {
  getCopilotClient,
  reportRuntime,
  resetCopilotClientForTests,
  resolveSessionEffort,
  TESTED_RUNTIME_VERSION,
  verifyModelListed,
} from '../copilot-client.js'

const model = (id: string, reasoning: boolean, ...efforts: string[]): ModelInfo =>
  ({
    id,
    name: id,
    capabilities: {
      supports: { vision: false, reasoningEffort: reasoning },
      limits: { max_context_window_tokens: 1 },
    },
    ...(reasoning ? { supportedReasoningEfforts: efforts } : {}),
  }) as unknown as ModelInfo

const MODELS = [
  model('claude-sonnet-5', true, 'low', 'medium', 'high', 'xhigh', 'max'),
  model('gpt-5.4', true, 'none', 'low', 'medium', 'high', 'xhigh'),
  model('claude-haiku-4.5', false),
]

beforeEach(() => {
  h.starts = 0
  h.startError = null
  h.status = { version: TESTED_RUNTIME_VERSION, protocolVersion: 3 }
  h.listModels.mockReset()
  Object.values(h.log).forEach((fn) => fn.mockReset())
  resetCopilotClientForTests()
})

describe('getCopilotClient', () => {
  it('starts the runtime once for concurrent first callers', async () => {
    const [a, b] = await Promise.all([getCopilotClient(), getCopilotClient()])
    expect(a).toBe(b)
    expect(h.starts).toBe(1)
  })

  it('does not cache a failed start, so a recovered runtime needs no restart', async () => {
    h.startError = new Error('runtime not reachable')
    await expect(getCopilotClient()).rejects.toThrow('runtime not reachable')
    h.startError = null
    await expect(getCopilotClient()).resolves.toBeDefined()
    expect(h.starts).toBe(2)
  })

  it('reports the runtime it started', async () => {
    await getCopilotClient()
    expect(h.log.info).toHaveBeenCalledWith(
      'Copilot runtime started',
      expect.objectContaining({ runtimeVersion: TESTED_RUNTIME_VERSION, protocolVersion: 3 })
    )
  })
})

describe('reportRuntime', () => {
  const client = { getStatus: async () => h.status }

  it('is quiet about the tested runtime', async () => {
    await reportRuntime(client, {})
    expect(h.log.warn).not.toHaveBeenCalled()
    expect(h.log.info).toHaveBeenCalledOnce()
  })

  it('warns when the runtime is not the one tested with the pinned SDK', async () => {
    h.status = { version: '1.0.98', protocolVersion: 3 }
    await reportRuntime(client, {})
    const [message, facts] = h.log.warn.mock.calls[0] as [string, Record<string, unknown>]
    expect(message).toContain('1.0.98')
    expect(message).toContain(TESTED_RUNTIME_VERSION)
    expect(facts).toMatchObject({ runtimeVersion: '1.0.98', protocolVersion: 3 })
  })

  it('warns about COPILOT_CLI_PATH even when the version happens to match', async () => {
    await reportRuntime(client, { COPILOT_CLI_PATH: '/opt/copilot/index.js' })
    const [message, facts] = h.log.warn.mock.calls[0] as [string, Record<string, unknown>]
    expect(message).toContain('COPILOT_CLI_PATH')
    expect(message).toContain('not tested or supported')
    expect(facts).toMatchObject({ runtimeOverride: '/opt/copilot/index.js' })
  })

  it('never throws: diagnostics cannot fail startup', async () => {
    await expect(
      reportRuntime({ getStatus: () => Promise.reject(new Error('no status')) }, {})
    ).resolves.toBeUndefined()
    expect(h.log.warn).not.toHaveBeenCalled()
  })
})

describe('resolveSessionEffort', () => {
  const client = () => ({ listModels: vi.fn().mockResolvedValue(MODELS) })

  it('sends none only to a model that advertises it', async () => {
    const c = client()
    await expect(resolveSessionEffort(c, 'gpt-5.4', 'none')).resolves.toBe('none')
    await expect(resolveSessionEffort(c, 'claude-sonnet-5', 'none')).resolves.toBe('low')
    await expect(resolveSessionEffort(c, 'claude-haiku-4.5', 'none')).resolves.toBeUndefined()
  })

  it('lists the models once per client, however many sessions are created', async () => {
    const c = client()
    await resolveSessionEffort(c, 'claude-sonnet-5', 'none')
    await resolveSessionEffort(c, 'claude-sonnet-5', 'none')
    await resolveSessionEffort(c, 'gpt-5.4', 'none')
    expect(c.listModels).toHaveBeenCalledOnce()
  })

  it('logs a departure from the request once, not per session', async () => {
    const c = client()
    await resolveSessionEffort(c, 'claude-sonnet-5', 'none')
    await resolveSessionEffort(c, 'claude-sonnet-5', 'none')
    expect(h.log.warn).toHaveBeenCalledOnce()
    expect(h.log.warn.mock.calls[0]?.[0]).toContain("'none' is not advertised")
  })

  it('does not list models when nothing is requested', async () => {
    const c = client()
    await expect(resolveSessionEffort(c, 'claude-sonnet-5', null)).resolves.toBeUndefined()
    expect(c.listModels).not.toHaveBeenCalled()
  })

  it('does not send an unverifiable none when the listing fails, and retries next time', async () => {
    const c = {
      listModels: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(MODELS),
    }
    await expect(resolveSessionEffort(c, 'gpt-5.4', 'none')).resolves.toBeUndefined()
    await expect(resolveSessionEffort(c, 'gpt-5.4', 'none')).resolves.toBe('none')
    expect(c.listModels).toHaveBeenCalledTimes(2)
  })

  it('treats a model the runtime does not list as unknown', async () => {
    await expect(resolveSessionEffort(client(), 'not-a-model', 'none')).resolves.toBeUndefined()
    await expect(resolveSessionEffort(client(), 'not-a-model', 'high')).resolves.toBe('high')
  })

  it('tolerates a client without a model listing', async () => {
    await expect(resolveSessionEffort({} as never, 'gpt-5.4', 'none')).resolves.toBeUndefined()
  })
})

describe('verifyModelListed', () => {
  it('accepts a listed model', async () => {
    h.listModels.mockResolvedValue(MODELS)
    await expect(verifyModelListed('claude-sonnet-5')).resolves.toBeUndefined()
  })

  it('names the setting and the available models when the model is not listed', async () => {
    h.listModels.mockResolvedValue(MODELS)
    const error = await verifyModelListed('claude-sonet-5').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AgentError)
    expect((error as Error).message).toContain('AI_MODEL')
    expect((error as Error).message).toContain('claude-sonet-5')
    expect((error as Error).message).toContain('claude-sonnet-5, gpt-5.4, claude-haiku-4.5')
  })

  it('does not fail startup when the listing is unavailable', async () => {
    h.listModels.mockRejectedValue(new Error('offline'))
    await expect(verifyModelListed('claude-sonnet-5')).resolves.toBeUndefined()
  })

  it('has nothing to check without a configured model', async () => {
    await expect(verifyModelListed(undefined)).resolves.toBeUndefined()
    expect(h.listModels).not.toHaveBeenCalled()
  })
})
