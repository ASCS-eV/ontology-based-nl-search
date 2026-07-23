import { describe, expect, it } from 'vitest'

import { NullAuthoringBackend } from '../null-backend.js'

describe('NullAuthoringBackend', () => {
  const backend = new NullAuthoringBackend()

  it('describe() reports no engine and empty versions', async () => {
    const info = await backend.describe()
    expect(info.engine).toBe('null')
    expect(info.oscVersions).toEqual([])
    expect(info.xsd).toBe('none')
  })

  it('validate() always fails with a single explanatory diagnostic', async () => {
    const result = await backend.validate('<OpenSCENARIO/>')
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]?.severity).toBe('error')
    expect(result.diagnostics[0]?.message).toMatch(/unavailable/i)
  })

  it('lower() rejects — no engine is available to author', async () => {
    await expect(backend.lower({ entities: [], actions: [] })).rejects.toThrow(/unavailable/i)
  })

  it('isReady() is true — it is deterministically available', async () => {
    expect(await backend.isReady()).toBe(true)
  })

  it('close() is a no-op', async () => {
    await expect(backend.close()).resolves.toBeUndefined()
  })
})
