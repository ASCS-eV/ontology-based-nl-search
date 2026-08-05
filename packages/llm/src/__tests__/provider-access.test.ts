/**
 * Regression tests for the startup provider check.
 *
 * The failure it prevents: the API logged "ready", `/health` answered `ok`,
 * and the first search then died on a provider that was never reachable. The
 * mirror-image failure it must also avoid: refusing to start a setup that
 * works, because the probe over-interpreted an endpoint that answers
 * differently. Both directions are asserted here.
 */
import { AgentError } from '@ontology-search/core/errors'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isModelAvailable, parseModelIds, verifyProviderAccess } from '../provider-access.js'

const { resetConfig } = await import('@ontology-search/core/config')

/**
 * Mutate the keys in place and restore them afterwards, rather than swapping
 * `process.env` for a copy: replacing the object detaches it from the real
 * process environment, so `os.homedir()` — which the credential providers go
 * through — would keep reading the developer's actual HOME.
 */
const TOUCHED_KEYS = [
  'AI_PROVIDER',
  'AI_MODEL',
  'OLLAMA_BASE_URL',
  'ANTHROPIC_API_KEY',
  'HOME',
  'NODE_ENV',
] as const
const saved = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of TOUCHED_KEYS) saved.set(key, process.env[key])
  process.env.NODE_ENV = 'test'
  resetConfig()
})

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  saved.clear()
  resetConfig()
})

/** A `/models` response with the given ids. */
function modelsResponse(ids: string[], status = 200): Response {
  return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), { status })
}

function useOllama(model = 'qwen3:8b'): void {
  process.env.AI_PROVIDER = 'ollama'
  process.env.AI_MODEL = model
  process.env.OLLAMA_BASE_URL = 'http://localhost:11434/v1'
  resetConfig()
}

describe('parseModelIds', () => {
  it('reads ids from an OpenAI-compatible listing', () => {
    expect(parseModelIds({ data: [{ id: 'qwen3:8b' }, { id: 'llama3.3' }] })).toEqual([
      'qwen3:8b',
      'llama3.3',
    ])
  })

  it('returns null for anything that is not a non-empty listing', () => {
    expect(parseModelIds({ data: [] })).toBeNull()
    expect(parseModelIds({ models: ['qwen3:8b'] })).toBeNull()
    expect(parseModelIds(null)).toBeNull()
  })
})

describe('isModelAvailable', () => {
  it('accepts an exact id', () => {
    expect(isModelAvailable('qwen3:8b', ['qwen3:8b'])).toBe(true)
  })

  it('accepts the implicit :latest tag in both directions', () => {
    // `ollama pull qwen3` stores `qwen3:latest`; AI_MODEL may name either.
    expect(isModelAvailable('qwen3', ['qwen3:latest'])).toBe(true)
    expect(isModelAvailable('qwen3:latest', ['qwen3'])).toBe(true)
  })

  it('rejects a model that is not served', () => {
    expect(isModelAvailable('qwen3:8b', ['llama3.3', 'qwen3:4b'])).toBe(false)
  })
})

describe('verifyProviderAccess (ollama)', () => {
  it('passes when the endpoint serves the configured model', async () => {
    useOllama()
    const fetchImpl = vi.fn().mockResolvedValue(modelsResponse(['qwen3:8b']))

    await expect(verifyProviderAccess({ fetchImpl })).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:11434/v1/models',
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('reports a refused connection as "Ollama is not reachable", with the fix', async () => {
    useOllama()
    const fetchImpl = vi.fn().mockRejectedValue(
      Object.assign(new Error('fetch failed'), {
        cause: new Error('connect ECONNREFUSED 127.0.0.1:11434'),
      })
    )

    await expect(verifyProviderAccess({ fetchImpl })).rejects.toThrow(AgentError)
    await expect(verifyProviderAccess({ fetchImpl })).rejects.toThrow(/ollama serve/)
  })

  it('reports a timeout as a reachability failure rather than hanging startup', async () => {
    useOllama()
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'))

    await expect(verifyProviderAccess({ fetchImpl, timeoutMs: 5 })).rejects.toThrow(/not reachable/)
  })

  it('names the pull command when the model was never pulled', async () => {
    useOllama('qwen3:8b')
    const fetchImpl = vi.fn().mockResolvedValue(modelsResponse(['llama3.3']))

    await expect(verifyProviderAccess({ fetchImpl })).rejects.toThrow(/ollama pull qwen3:8b/)
  })

  it('does NOT fail a working endpoint that has no usable model listing', async () => {
    // A gateway that answers 404 (or a non-listing shape) proves nothing about
    // the model; refusing to start there would ground a working deployment.
    useOllama()
    for (const response of [
      new Response('nope', { status: 404 }),
      new Response(JSON.stringify({ models: ['qwen3:8b'] }), { status: 200 }),
    ]) {
      const fetchImpl = vi.fn().mockResolvedValue(response)
      await expect(verifyProviderAccess({ fetchImpl })).resolves.toBeUndefined()
    }
  })

  it('reports a credential rejection from the endpoint', async () => {
    useOllama()
    const fetchImpl = vi.fn().mockResolvedValue(new Response('no', { status: 401 }))

    await expect(verifyProviderAccess({ fetchImpl })).rejects.toThrow(/rejected the credentials/)
  })
})

describe('verifyProviderAccess (credential-file providers)', () => {
  it('surfaces the actionable credentials error for claude-cli', async () => {
    process.env.AI_PROVIDER = 'claude-cli'
    process.env.AI_MODEL = 'claude-haiku-4-5'
    process.env.HOME = '/nonexistent-home-for-this-test'
    resetConfig()
    const fetchImpl = vi.fn()

    // The provider factory reads ~/.claude/.credentials.json; with HOME
    // pointed at nothing, that read must produce the "run claude" advice —
    // at startup, not on the first query.
    await expect(verifyProviderAccess({ fetchImpl })).rejects.toThrow(/credentials/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('makes no network call for a key-based provider', async () => {
    process.env.AI_PROVIDER = 'anthropic'
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.AI_MODEL = 'claude-haiku-4-5'
    resetConfig()
    const fetchImpl = vi.fn()

    await expect(verifyProviderAccess({ fetchImpl })).resolves.toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
