import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { loadVocabulary } from '../vocabulary-loader.js'

const fixturePath = fileURLToPath(new URL('../__fixtures__/vocabulary.json', import.meta.url))
const fixture = await readFile(fixturePath, 'utf8')
const SECRET = 'fixture-api-key-that-must-not-leak'

describe('loadVocabulary', () => {
  it('loads a valid local file', async () => {
    const vocabulary = await loadVocabulary({ type: 'file', value: fixturePath })
    expect(vocabulary.domains).toEqual(['hdmap', 'trace'])
    expect(vocabulary.properties.some((property) => property.type === 'string')).toBe(true)
  })

  it('loads a URL with a protected, non-redirecting request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(fixture, { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
    const vocabulary = await loadVocabulary(
      { type: 'url', value: 'https://example.test/vocabulary' },
      { fetchImpl, apiKey: SECRET }
    )
    expect(vocabulary.domains).toContain('hdmap')
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://example.test/vocabulary'),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${SECRET}` },
        redirect: 'error',
      })
    )
  })

  it('rejects non-success responses without exposing the API key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('denied', { status: 401 }))
    const error = await loadVocabulary(
      { type: 'url', value: 'https://example.test/vocabulary' },
      { fetchImpl, apiKey: SECRET }
    ).catch((caught: unknown) => caught)
    expect(String(error)).toContain('HTTP 401')
    expect(String(error)).not.toContain(SECRET)
  })

  it('reports timeouts without exposing the API key', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    const error = await loadVocabulary(
      { type: 'url', value: 'https://example.test/vocabulary' },
      { fetchImpl, apiKey: SECRET, timeoutMs: 5 }
    ).catch((caught: unknown) => caught)
    expect(String(error)).toContain('timed out')
    expect(String(error)).not.toContain(SECRET)
  })

  it('rejects malformed JSON and an invalid strict shape', async () => {
    const malformedFetch = vi.fn().mockResolvedValue(new Response('{'))
    await expect(
      loadVocabulary(
        { type: 'url', value: 'https://example.test/vocabulary' },
        { fetchImpl: malformedFetch }
      )
    ).rejects.toThrow(/valid JSON/)

    const wrongShapeFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ domains: ['asset'], properties: [], extra: true }))
      )
    await expect(
      loadVocabulary(
        { type: 'url', value: 'https://example.test/vocabulary' },
        { fetchImpl: wrongShapeFetch }
      )
    ).rejects.toThrow(/invalid shape/)
  })

  it('rejects ambiguous vocabulary names during initialization', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ domains: ['asset-domain', 'asset_domain'], properties: [] }))
      )
    await expect(
      loadVocabulary({ type: 'url', value: 'https://example.test/vocabulary' }, { fetchImpl })
    ).rejects.toThrow(/both map to GraphQL name/)
  })

  it('rejects embedded URL credentials and oversized responses', async () => {
    await expect(
      loadVocabulary({ type: 'url', value: 'https://user:password@example.test/vocabulary' })
    ).rejects.toThrow(/must not contain credentials/)

    const fetchImpl = vi.fn().mockResolvedValue(new Response(fixture))
    await expect(
      loadVocabulary(
        { type: 'url', value: 'https://example.test/vocabulary' },
        { fetchImpl, maxBytes: 10 }
      )
    ).rejects.toThrow(/byte limit/)
  })
})
