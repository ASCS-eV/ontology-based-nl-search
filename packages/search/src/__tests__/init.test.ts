import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ontology-search/sparql', () => ({
  getSparqlStore: vi.fn(() => ({
    load: vi.fn(),
    query: vi.fn(),
  })),
}))

vi.mock('../data-loader.js', () => ({
  loadSampleData: vi.fn().mockResolvedValue(undefined),
}))

describe('getInitializedStore', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns the same store instance on concurrent calls', async () => {
    const { getInitializedStore: getStore } = await import('../init.js')

    const [store1, store2, store3] = await Promise.all([getStore(), getStore(), getStore()])

    expect(store1).toBe(store2)
    expect(store2).toBe(store3)
  })

  it('calls loadSampleData exactly once in memory mode', async () => {
    const dataLoader = await import('../data-loader.js')
    const { getInitializedStore: getStore } = await import('../init.js')

    await Promise.all([getStore(), getStore(), getStore()])

    expect(dataLoader.loadSampleData).toHaveBeenCalledTimes(1)
  })

  it('skips loadSampleData when SPARQL_MODE is remote', async () => {
    process.env['SPARQL_MODE'] = 'remote'
    process.env['SPARQL_ENDPOINT'] = 'http://localhost:3030/test/sparql'

    const { resetConfig } = await import('@ontology-search/core/config')
    resetConfig()
    const dataLoader = await import('../data-loader.js')
    const { getInitializedStore: getStore } = await import('../init.js')

    await getStore()

    expect(dataLoader.loadSampleData).not.toHaveBeenCalled()

    delete process.env['SPARQL_MODE']
    delete process.env['SPARQL_ENDPOINT']
    resetConfig()
  })
})
