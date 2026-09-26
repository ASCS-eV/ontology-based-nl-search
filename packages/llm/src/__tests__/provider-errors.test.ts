/**
 * Regression tests for provider-failure translation.
 *
 * Each case below is a message a developer actually hit during onboarding and
 * could not act on. The assertions are about the ADVICE — the setting to
 * change and the command to run — because that is the part the raw SDK error
 * never carried.
 */
import { AgentError } from '@ontology-search/core/errors'
import { describe, expect, it } from 'vitest'

import {
  classifyProviderFailure,
  collectErrorFacts,
  providerContextFromConfig,
  toProviderAgentError,
  withProviderErrorTranslation,
} from '../provider-errors.js'

/** The shape the AI SDK produces: a retry wrapper around an API-call error. */
function retryError(lastError: unknown) {
  return Object.assign(new Error('Failed after 3 attempts. Last error: AI_APICallError'), {
    name: 'AI_RetryError',
    lastError,
  })
}

function apiCallError(message: string, statusCode?: number, cause?: unknown) {
  return Object.assign(new Error(message), {
    name: 'AI_APICallError',
    ...(statusCode === undefined ? {} : { statusCode }),
    ...(cause === undefined ? {} : { cause }),
  })
}

const OLLAMA = {
  provider: 'ollama' as const,
  model: 'qwen3:8b',
  endpoint: 'http://localhost:11434/v1',
}

const CLAUDE_CLI = { provider: 'claude-cli' as const, model: 'claude-sonnet-5' }

/**
 * The 429 the Anthropic endpoint returned for `claude-sonnet-5` on a Claude
 * subscription token: bare "Error", and none of the subscription limiter's
 * headers (the request id and retry hint are the headers it did carry).
 */
function subscriptionRefusal(overrides: { message?: string; headers?: Record<string, string> }) {
  return Object.assign(new Error(overrides.message ?? 'Error'), {
    name: 'AI_APICallError',
    statusCode: 429,
    responseHeaders: overrides.headers ?? {
      'request-id': 'req_011CfSHmij3KU4apTGjxR87x',
      'x-should-retry': 'true',
    },
  })
}

/** A genuine subscription usage-limit rejection: the limiter judged it. */
const USAGE_LIMIT_HEADERS = {
  'anthropic-ratelimit-unified-status': 'rejected',
  'anthropic-ratelimit-unified-reset': '1790451600',
}

describe('collectErrorFacts', () => {
  it('reaches the real cause through the SDK retry/API-call wrappers', () => {
    const error = retryError(
      apiCallError(
        'Cannot connect to API',
        undefined,
        new Error('connect ECONNREFUSED 127.0.0.1:11434')
      )
    )
    const facts = collectErrorFacts(error)
    expect(facts.text).toContain('ECONNREFUSED')
    expect(facts.statusCode).toBeUndefined()
  })

  it('finds the status code carried by a nested API-call error', () => {
    expect(collectErrorFacts(retryError(apiCallError('invalid x-api-key', 401))).statusCode).toBe(
      401
    )
  })

  it('keeps the message and headers of the link that carried the status', () => {
    const facts = collectErrorFacts(retryError(subscriptionRefusal({})))
    expect(facts.statusCode).toBe(429)
    expect(facts.response?.message).toBe('Error')
    expect(facts.response?.headers?.['x-should-retry']).toBe('true')
  })

  it('terminates on a self-referencing cause chain', () => {
    const error: { message: string; cause?: unknown } = { message: 'loop' }
    error.cause = error
    expect(() => collectErrorFacts(error)).not.toThrow()
  })
})

describe('classifyProviderFailure', () => {
  it('classifies a refused connection as unreachable, not as an auth problem', () => {
    const error = retryError(
      apiCallError(
        'Cannot connect to API',
        undefined,
        new Error('connect ECONNREFUSED 127.0.0.1:11434')
      )
    )
    expect(classifyProviderFailure(error)).toBe('unreachable')
  })

  it('classifies 401/403 and rejected-key wording as unauthorized', () => {
    expect(classifyProviderFailure(apiCallError('invalid x-api-key', 401))).toBe('unauthorized')
    expect(classifyProviderFailure(apiCallError('forbidden', 403))).toBe('unauthorized')
    expect(classifyProviderFailure(new Error('invalid x-api-key'))).toBe('unauthorized')
  })

  it('classifies an unknown model as model-not-found', () => {
    expect(
      classifyProviderFailure(apiCallError('model "qwen3:8b" not found, try pulling it first', 404))
    ).toBe('model-not-found')
  })

  it('leaves anything else unclassified rather than guessing', () => {
    expect(classifyProviderFailure(new Error('Unexpected token < in JSON'))).toBeUndefined()
    expect(classifyProviderFailure(apiCallError('overloaded', 529))).toBeUndefined()
  })

  it('classifies the claude-cli subscription refusal as model-not-permitted, not a usage limit', () => {
    // Exactly what the SDK threw for `AI_MODEL=claude-sonnet-5`: three
    // retried attempts wrapping the same disguised 429.
    expect(classifyProviderFailure(retryError(subscriptionRefusal({})), 'claude-cli')).toBe(
      'model-not-permitted'
    )
  })

  it('never calls a genuine subscription usage limit a model refusal', () => {
    // The limiter's status header proves it judged the request: a real quota.
    const usageLimit = subscriptionRefusal({ headers: USAGE_LIMIT_HEADERS })
    expect(classifyProviderFailure(retryError(usageLimit), 'claude-cli')).toBeUndefined()
  })

  it('makes the refusal classification only when every signal is present', () => {
    // No headers recorded: the limiter's absence cannot be proven.
    const headerless = Object.assign(new Error('Error'), { statusCode: 429 })
    expect(classifyProviderFailure(headerless, 'claude-cli')).toBeUndefined()
    // A descriptive message is already actionable on its own.
    const descriptive = subscriptionRefusal({ message: 'Number of requests exceeded' })
    expect(classifyProviderFailure(descriptive, 'claude-cli')).toBeUndefined()
    // Other providers' 429s are ordinary rate limits.
    expect(classifyProviderFailure(subscriptionRefusal({}), 'anthropic')).toBeUndefined()
    expect(classifyProviderFailure(subscriptionRefusal({}))).toBeUndefined()
  })
})

describe('toProviderAgentError', () => {
  it('names Ollama and how to start it instead of "Cannot connect to API"', () => {
    const error = retryError(
      apiCallError(
        'Cannot connect to API',
        undefined,
        new Error('connect ECONNREFUSED 127.0.0.1:11434')
      )
    )
    const translated = toProviderAgentError(error, OLLAMA)

    expect(translated).toBeInstanceOf(AgentError)
    expect(translated?.message).toContain('Ollama is not reachable at http://localhost:11434/v1')
    expect(translated?.message).toContain('ollama serve')
    expect(translated?.message).toContain('OLLAMA_BASE_URL')
    // The original stays reachable for the logs.
    expect(translated?.cause).toBe(error)
  })

  it('tells an ollama user to pull the model they configured', () => {
    const translated = toProviderAgentError(apiCallError('model not found', 404), OLLAMA)
    expect(translated?.message).toContain('ollama pull qwen3:8b')
    expect(translated?.message).toContain('tool calling')
  })

  it('also names the base URL on a 404, which has the same two causes', () => {
    // A 404 from a base URL that does not serve the OpenAI-compatible API
    // looks identical to a model that was never pulled. Advising only the pull
    // would be exactly the confident misdirection this module removes.
    const translated = toProviderAgentError(apiCallError('404 page not found', 404), OLLAMA)
    expect(translated?.message).toContain('OLLAMA_BASE_URL (http://localhost:11434/v1)')
  })

  it('explains that "invalid x-api-key" is not about a key on the claude-cli provider', () => {
    const translated = toProviderAgentError(apiCallError('invalid x-api-key', 401), {
      provider: 'claude-cli',
      model: 'claude-haiku-4-5',
    })
    expect(translated?.message).toContain('does not mean a key is misconfigured')
    expect(translated?.message).toContain('Run `claude` to re-authenticate')
  })

  it('tells a claude-cli user the model is refused, not rate-limited, and how to proceed', () => {
    const error = retryError(subscriptionRefusal({}))
    const translated = toProviderAgentError(error, CLAUDE_CLI)

    expect(translated).toBeInstanceOf(AgentError)
    expect(translated?.message).toContain('does not serve "claude-sonnet-5"')
    expect(translated?.message).toContain('not a usage limit')
    expect(translated?.message).toContain('claude-haiku-4-5-20251001')
    expect(translated?.message).toContain('AI_PROVIDER=anthropic with ANTHROPIC_API_KEY')
    expect(translated?.cause).toBe(error)
  })

  it('points key-based providers at their own credential', () => {
    const cases = [
      { provider: 'openai' as const, expected: 'OPENAI_API_KEY' },
      { provider: 'anthropic' as const, expected: 'ANTHROPIC_API_KEY' },
      { provider: 'vibe-cli' as const, expected: 'vibe --setup' },
    ]
    for (const { provider, expected } of cases) {
      const translated = toProviderAgentError(apiCallError('unauthorized', 401), {
        provider,
        model: 'some-model',
      })
      expect(translated?.message).toContain(expected)
    }
  })

  it('offers the Copilot CLI login before the optional overriding token', () => {
    const translated = toProviderAgentError(apiCallError('unauthorized', 401), {
      provider: 'copilot',
      model: 'some-model',
    })
    expect(translated?.message).toContain('copilot login')
    expect(translated?.message).toContain('optional GITHUB_TOKEN')
    expect(translated?.message).toContain('takes precedence')
  })

  it('never translates an abort — a cancelled request is not a fault', () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    expect(toProviderAgentError(abort, OLLAMA)).toBeUndefined()
  })

  it('leaves an already-actionable AgentError untouched', () => {
    const original = new AgentError('Claude CLI credentials not found. Run "claude".')
    expect(toProviderAgentError(original, OLLAMA)).toBeUndefined()
  })

  it('leaves an unrecognized failure alone', () => {
    expect(toProviderAgentError(new Error('boom'), OLLAMA)).toBeUndefined()
  })

  it('sends a rejected claude-code login to `claude`, not to a key the app never held', () => {
    const translated = toProviderAgentError(apiCallError('unauthorized', 401), {
      provider: 'claude-code',
      model: 'claude-sonnet-5',
    })
    expect(translated?.message).toContain('claude auth login')
    expect(translated?.message).not.toContain('API_KEY')
  })
})

describe('withProviderErrorTranslation', () => {
  it('passes results through untouched', async () => {
    await expect(withProviderErrorTranslation(OLLAMA, async () => 'ok')).resolves.toBe('ok')
  })

  it('rethrows an untranslatable error as-is', async () => {
    const original = new Error('boom')
    await expect(
      withProviderErrorTranslation(OLLAMA, async () => {
        throw original
      })
    ).rejects.toBe(original)
  })

  it('replaces a translatable error with the actionable one', async () => {
    await expect(
      withProviderErrorTranslation(OLLAMA, async () => {
        throw apiCallError('invalid_api_key', 401)
      })
    ).rejects.toThrow(/rejected the credentials/)
  })
})

describe('providerContextFromConfig', () => {
  const baseConfig = {
    AI_PROVIDER: 'ollama',
    AI_MODEL: 'qwen3:8b',
    AUTHORING_AI_MODEL: 'claude-opus-4.8',
    OLLAMA_BASE_URL: 'http://localhost:11434/v1',
    MISTRAL_BASE_URL: 'https://api.mistral.ai/v1',
  } as Parameters<typeof providerContextFromConfig>[0]

  it('reports the endpoint for endpoint-configurable providers only', () => {
    expect(providerContextFromConfig(baseConfig).endpoint).toBe('http://localhost:11434/v1')
    expect(
      providerContextFromConfig({ ...baseConfig, AI_PROVIDER: 'anthropic' }).endpoint
    ).toBeUndefined()
  })

  it('names the authoring model when the authoring agent is the caller', () => {
    expect(providerContextFromConfig(baseConfig).model).toBe('qwen3:8b')
    expect(providerContextFromConfig(baseConfig, { authoring: true }).model).toBe('claude-opus-4.8')
  })

  it('falls back to AI_MODEL when no authoring override is set', () => {
    const config = { ...baseConfig, AUTHORING_AI_MODEL: undefined }
    expect(providerContextFromConfig(config, { authoring: true }).model).toBe('qwen3:8b')
  })
})
