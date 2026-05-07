import { getSparqlStore } from '../index'

describe('getSparqlStore', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should return CachedSparqlStore wrapping OxigraphStore when SPARQL_MODE is memory', async () => {
    process.env.SPARQL_MODE = 'memory'
    const { resetConfig } = await import('@/lib/config')
    resetConfig()
    const { getSparqlStore: getStore } = await import('../index')
    const store = getStore()
    expect(store).toBeDefined()
    expect(store.constructor.name).toBe('CachedSparqlStore')
  })

  it('should throw when SPARQL_MODE is remote without endpoint', async () => {
    process.env.SPARQL_MODE = 'remote'
    delete process.env.SPARQL_ENDPOINT
    const { resetConfig } = await import('@/lib/config')
    resetConfig()
    const { getSparqlStore: getStore } = await import('../index')
    expect(() => getStore()).toThrow('SPARQL_ENDPOINT is required when SPARQL_MODE is "remote"')
  })

  it('should return CachedSparqlStore wrapping RemoteSparqlStore when properly configured', async () => {
    process.env.SPARQL_MODE = 'remote'
    process.env.SPARQL_ENDPOINT = 'http://localhost:3030/test/sparql'
    const { resetConfig } = await import('@/lib/config')
    resetConfig()
    const { getSparqlStore: getStore } = await import('../index')
    const store = getStore()
    expect(store.constructor.name).toBe('CachedSparqlStore')
  })
})
