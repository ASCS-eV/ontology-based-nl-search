/**
 * Contract tests for the agent backend seam.
 *
 * Provider selection used to be a bare `AI_PROVIDER === 'copilot'` ternary at
 * three separate call sites — startup verification, search slot-filling, and
 * scene filling. Nothing forced them to agree, so a fourth call site (or a
 * fourth provider) could silently pick differently, and the search half and the
 * authoring half of one request could run against different providers.
 *
 * These pin the property that matters: ONE decision, read by every consumer.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getAgentBackend } from '../backend.js'

const { resetConfig } = await import('@ontology-search/core/config')

/**
 * Mutate the keys in place and restore them afterwards rather than swapping
 * `process.env` — replacing the object detaches it from the real environment,
 * which the credential providers read through `os.homedir()`.
 */
const TOUCHED_KEYS = ['AI_PROVIDER', 'AI_MODEL', 'NODE_ENV'] as const
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

function useProvider(provider: string): void {
  process.env.AI_PROVIDER = provider
  resetConfig()
}

describe('getAgentBackend', () => {
  it('selects the Copilot backend for AI_PROVIDER=copilot', () => {
    useProvider('copilot')
    expect(getAgentBackend().id).toBe('copilot')
  })

  it.each(['openai', 'anthropic', 'ollama', 'claude-cli', 'vibe-cli'])(
    'selects the Vercel backend for AI_PROVIDER=%s',
    (provider) => {
      useProvider(provider)
      expect(getAgentBackend().id).toBe('vercel')
    }
  )

  /**
   * The reason this seam exists. Search fills slots and authoring fills a
   * scene; when those were selected independently, nothing prevented one from
   * resolving to Copilot and the other to Vercel.
   */
  it.each(['copilot', 'ollama'])(
    'serves slot-filling and scene-filling from the SAME backend (%s)',
    (provider) => {
      useProvider(provider)
      const backend = getAgentBackend()
      expect(getAgentBackend()).toBe(backend)
      expect(backend.fillSlots).toBeTypeOf('function')
      expect(backend.fillScene).toBeTypeOf('function')
      expect(backend.verify).toBeTypeOf('function')
    }
  )

  it('re-reads the configured provider rather than caching the first one', () => {
    useProvider('ollama')
    expect(getAgentBackend().id).toBe('vercel')
    useProvider('copilot')
    expect(getAgentBackend().id).toBe('copilot')
  })

  /**
   * Every provider the config schema admits must map to a backend. A new
   * provider added to the enum without a mapping would otherwise fall through
   * to the Vercel path silently — which is the right default, but only when it
   * is a decision rather than an accident.
   */
  it('resolves a backend for every provider the config accepts', async () => {
    const { AI_PROVIDERS } = await import('@ontology-search/core/config')
    expect(AI_PROVIDERS.length).toBeGreaterThan(1)
    for (const provider of AI_PROVIDERS) {
      useProvider(provider)
      expect(getAgentBackend().id, `no backend for ${provider}`).toBeTruthy()
    }
  })
})
