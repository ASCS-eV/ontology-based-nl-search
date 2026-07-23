import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

describe('getAuthoringBackend', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, NODE_ENV: 'test' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns WasmAuthoringBackend by default and memoizes it', async () => {
    delete process.env.AUTHORING_MODE
    const { resetConfig } = await import('@ontology-search/core/config')
    resetConfig()
    const { getAuthoringBackend, closeAuthoringBackend } = await import('../index.js')
    const backend = getAuthoringBackend()
    expect(backend.constructor.name).toBe('WasmAuthoringBackend')
    expect(getAuthoringBackend()).toBe(backend)
    await closeAuthoringBackend()
  })

  it('returns NullAuthoringBackend when AUTHORING_MODE is null', async () => {
    process.env.AUTHORING_MODE = 'null'
    const { resetConfig } = await import('@ontology-search/core/config')
    resetConfig()
    const { getAuthoringBackend, closeAuthoringBackend } = await import('../index.js')
    expect(getAuthoringBackend().constructor.name).toBe('NullAuthoringBackend')
    await closeAuthoringBackend()
  })

  it('closeAuthoringBackend is idempotent and clears the singleton', async () => {
    process.env.AUTHORING_MODE = 'null'
    const { resetConfig } = await import('@ontology-search/core/config')
    resetConfig()
    const { getAuthoringBackend, closeAuthoringBackend } = await import('../index.js')
    const first = getAuthoringBackend()
    await closeAuthoringBackend()
    await closeAuthoringBackend()
    const second = getAuthoringBackend()
    expect(second).not.toBe(first)
    await closeAuthoringBackend()
  })
})
