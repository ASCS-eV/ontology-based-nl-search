import { getInitializedStore } from '../init'

// Mock dependencies
jest.mock('@/lib/sparql', () => ({
  getSparqlStore: jest.fn(() => ({
    load: jest.fn(),
    query: jest.fn(),
  })),
}))

jest.mock('@/lib/data/loader', () => ({
  loadSampleData: jest.fn().mockResolvedValue(undefined),
}))

describe('getInitializedStore', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns the same store instance on concurrent calls', async () => {
    const { getInitializedStore: getStore } = await import('../init')

    const [store1, store2, store3] = await Promise.all([getStore(), getStore(), getStore()])

    expect(store1).toBe(store2)
    expect(store2).toBe(store3)
  })

  it('calls loadSampleData exactly once in memory mode', async () => {
    const { loadSampleData } = await import('@/lib/data/loader')
    const { getInitializedStore: getStore } = await import('../init')

    await Promise.all([getStore(), getStore(), getStore()])

    expect(loadSampleData).toHaveBeenCalledTimes(1)
  })

  it('skips loadSampleData when SPARQL_MODE is remote', async () => {
    process.env.SPARQL_MODE = 'remote'

    const { loadSampleData } = await import('@/lib/data/loader')
    const { getInitializedStore: getStore } = await import('../init')

    await getStore()

    expect(loadSampleData).not.toHaveBeenCalled()

    delete process.env.SPARQL_MODE
  })
})
