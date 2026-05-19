import { getConfig, resetConfig } from '../index.js'

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    resetConfig()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns default values when minimal env is set', () => {
    process.env.AI_PROVIDER = 'ollama'
    resetConfig()

    const config = getConfig()

    expect(config.SPARQL_MODE).toBe('memory')
    expect(config.AI_PROVIDER).toBe('ollama')
    expect(config.AI_MODEL).toBe('gpt-4o')
    expect(config.SPARQL_CACHE_SIZE).toBe(256)
    expect(config.SPARQL_CACHE_TTL_MS).toBe(300_000)
    expect(config.OLLAMA_BASE_URL).toBe('http://localhost:11434/v1')
  })

  it('caches config after first call', () => {
    process.env.AI_PROVIDER = 'ollama'
    resetConfig()

    const config1 = getConfig()
    const config2 = getConfig()

    expect(config1).toBe(config2)
  })

  it('throws on invalid SPARQL_MODE', () => {
    process.env.SPARQL_MODE = 'invalid'
    resetConfig()

    expect(() => getConfig()).toThrow('Invalid environment configuration')
  })

  it('throws when remote mode lacks endpoint', () => {
    process.env.SPARQL_MODE = 'remote'
    delete process.env.SPARQL_ENDPOINT
    resetConfig()

    expect(() => getConfig()).toThrow('SPARQL_ENDPOINT is required when SPARQL_MODE is "remote"')
  })

  it('accepts valid remote configuration', () => {
    process.env.SPARQL_MODE = 'remote'
    process.env.SPARQL_ENDPOINT = 'http://localhost:3030/sparql'
    process.env.AI_PROVIDER = 'ollama'
    resetConfig()

    const config = getConfig()

    expect(config.SPARQL_MODE).toBe('remote')
    expect(config.SPARQL_ENDPOINT).toBe('http://localhost:3030/sparql')
  })

  it('coerces numeric values from strings', () => {
    process.env.SPARQL_CACHE_SIZE = '512'
    process.env.SPARQL_CACHE_TTL_MS = '60000'
    process.env.AI_PROVIDER = 'ollama'
    resetConfig()

    const config = getConfig()

    expect(config.SPARQL_CACHE_SIZE).toBe(512)
    expect(config.SPARQL_CACHE_TTL_MS).toBe(60000)
  })

  it('enforces OPENAI_API_KEY requirement in non-test mode', () => {
    // Use Object.defineProperty to bypass readonly restriction in tests
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true })
    process.env.AI_PROVIDER = 'openai'
    delete process.env.OPENAI_API_KEY
    // Set an explicit origin so the production CORS cross-field check
    // doesn't fire first and mask the OPENAI_API_KEY error this test
    // is pinning.
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com'
    resetConfig()

    expect(() => getConfig()).toThrow('OPENAI_API_KEY is required when AI_PROVIDER is "openai"')

    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true })
    delete process.env.CORS_ALLOWED_ORIGINS
  })

  it('does not require OPENAI_API_KEY in test mode', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true })
    process.env.AI_PROVIDER = 'openai'
    delete process.env.OPENAI_API_KEY
    resetConfig()

    expect(() => getConfig()).not.toThrow()
  })

  /**
   * Regression for task 10: each key the audit identified as "should be
   * env-driven but is hardcoded" now has a default in the Zod schema and
   * an env override path. The defaults match the values the constants
   * carried before the refactor so behaviour is unchanged when no env
   * override is set.
   */
  describe('task-10 config keys', () => {
    beforeEach(() => {
      delete process.env.ONTOLOGY_ROOT
      delete process.env.API_PORT
      delete process.env.API_MAX_BODY_BYTES
      delete process.env.SPARQL_MAX_LIMIT
      delete process.env.SPARQL_REMOTE_TIMEOUT_MS
      delete process.env.LLM_MAX_AGENT_STEPS
      process.env.AI_PROVIDER = 'ollama'
      resetConfig()
    })

    it('exposes the expected defaults when no env override is set', () => {
      const config = getConfig()
      expect(config.ONTOLOGY_ROOT).toBeUndefined()
      expect(config.API_PORT).toBe(3003)
      expect(config.API_MAX_BODY_BYTES).toBe(64 * 1024)
      expect(config.SPARQL_MAX_LIMIT).toBe(500)
      expect(config.SPARQL_REMOTE_TIMEOUT_MS).toBe(30_000)
      expect(config.LLM_MAX_AGENT_STEPS).toBe(3)
    })

    it('coerces and adopts overrides from string env values', () => {
      process.env.ONTOLOGY_ROOT = '/tmp/custom-workspace'
      process.env.API_PORT = '4000'
      process.env.API_MAX_BODY_BYTES = '131072'
      process.env.SPARQL_MAX_LIMIT = '1000'
      process.env.SPARQL_REMOTE_TIMEOUT_MS = '5000'
      process.env.LLM_MAX_AGENT_STEPS = '5'
      resetConfig()

      const config = getConfig()
      expect(config.ONTOLOGY_ROOT).toBe('/tmp/custom-workspace')
      expect(config.API_PORT).toBe(4000)
      expect(config.API_MAX_BODY_BYTES).toBe(131072)
      expect(config.SPARQL_MAX_LIMIT).toBe(1000)
      expect(config.SPARQL_REMOTE_TIMEOUT_MS).toBe(5000)
      expect(config.LLM_MAX_AGENT_STEPS).toBe(5)
    })

    it('rejects non-positive integers for the numeric keys', () => {
      process.env.API_PORT = '0'
      resetConfig()
      expect(() => getConfig()).toThrow('Invalid environment configuration')

      process.env.API_PORT = '3003'
      process.env.SPARQL_MAX_LIMIT = '-1'
      resetConfig()
      expect(() => getConfig()).toThrow('Invalid environment configuration')
    })
  })

  describe('CORS allowlist', () => {
    /**
     * The unsafe combination is `NODE_ENV=production` + the wildcard
     * `*` origin — startup must fail fast so an operator never ships
     * an API that accepts requests from any browser origin.
     */
    it('rejects CORS_ALLOWED_ORIGINS="*" in production', () => {
      process.env.AI_PROVIDER = 'ollama'
      process.env.NODE_ENV = 'production'
      process.env.CORS_ALLOWED_ORIGINS = '*'
      resetConfig()
      expect(() => getConfig()).toThrow(/CORS_ALLOWED_ORIGINS="\*" is unsafe in production/)
    })

    it('accepts an explicit origin list in production', () => {
      process.env.AI_PROVIDER = 'ollama'
      process.env.NODE_ENV = 'production'
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com,https://staging.example.com'
      resetConfig()
      expect(getConfig().CORS_ALLOWED_ORIGINS).toContain('https://app.example.com')
    })

    it('defaults to "*" in development and test', () => {
      process.env.AI_PROVIDER = 'ollama'
      delete process.env.CORS_ALLOWED_ORIGINS
      resetConfig()
      expect(getConfig().CORS_ALLOWED_ORIGINS).toBe('*')
    })
  })

  describe('rate-limit knobs', () => {
    it('defaults RATE_LIMIT_RPS to 0 (disabled)', () => {
      process.env.AI_PROVIDER = 'ollama'
      delete process.env.RATE_LIMIT_RPS
      delete process.env.RATE_LIMIT_BURST
      resetConfig()
      const config = getConfig()
      expect(config.RATE_LIMIT_RPS).toBe(0)
      expect(config.RATE_LIMIT_BURST).toBe(10)
    })

    it('parses positive RATE_LIMIT_RPS', () => {
      process.env.AI_PROVIDER = 'ollama'
      process.env.RATE_LIMIT_RPS = '5'
      process.env.RATE_LIMIT_BURST = '20'
      resetConfig()
      const config = getConfig()
      expect(config.RATE_LIMIT_RPS).toBe(5)
      expect(config.RATE_LIMIT_BURST).toBe(20)
    })

    it('rejects negative RATE_LIMIT_RPS', () => {
      process.env.AI_PROVIDER = 'ollama'
      process.env.RATE_LIMIT_RPS = '-1'
      resetConfig()
      expect(() => getConfig()).toThrow('Invalid environment configuration')
    })
  })
})
