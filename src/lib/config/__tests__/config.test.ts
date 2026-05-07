import { getConfig, resetConfig } from '../index'

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
    resetConfig()

    expect(() => getConfig()).toThrow('OPENAI_API_KEY is required when AI_PROVIDER is "openai"')

    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true })
  })

  it('does not require OPENAI_API_KEY in test mode', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true })
    process.env.AI_PROVIDER = 'openai'
    delete process.env.OPENAI_API_KEY
    resetConfig()

    expect(() => getConfig()).not.toThrow()
  })
})
