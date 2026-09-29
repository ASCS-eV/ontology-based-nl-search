/**
 * `GET /gaps` and the recorder behind it: the ontology gap log is opt-in,
 * records nothing while off, and with a maintainer key is readable only with
 * that key, not the search key.
 */
import type { GapLogResponse } from '@ontology-search/api-types'
import { resetConfig } from '@ontology-search/core/config'
import { ERROR_CODE } from '@ontology-search/core/errors'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getGapLog, recordGapsWhenEnabled, resetGapLog } from '../gap-log.js'

// The routes under test never reach the search pipeline or the authoring
// engine; mock them so importing the app loads neither the LLM nor the WASM.
vi.mock('../search-factory.js', () => ({ searchNl: vi.fn(), searchRefine: vi.fn() }))
vi.mock('@ontology-search/llm/authoring', () => ({
  runSceneAgent: vi.fn(),
  runScenePipeline: vi.fn(),
}))

type Env = Record<string, string | undefined>

/** Run `fn` with the given variables set (undefined = unset), restoring them after. */
async function withEnv<T>(env: Env, fn: () => Promise<T>): Promise<T> {
  const previous: Env = {}
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetConfig()
  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    resetConfig()
  }
}

/** A fresh app module, built from the environment as it is now. */
async function freshApp() {
  vi.resetModules()
  return (await import('../app.js')).app
}

const GAP = { term: 'potholes', reason: 'Not a defined ontology property' }

afterEach(() => {
  resetGapLog()
})

describe('GET /gaps', () => {
  it('is off by default and answers 404', async () => {
    await withEnv({ FEATURE_GAP_LOG: undefined }, async () => {
      const res = await (await freshApp()).request('/gaps')
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({
        error: 'The gap log is not enabled',
        code: ERROR_CODE.NOT_FOUND,
      })
    })
  })

  it('serves what searches recorded while on', async () => {
    await withEnv({ FEATURE_GAP_LOG: 'true' }, async () => {
      const app = await freshApp()
      const { recordGapsWhenEnabled: record } = await import('../gap-log.js')
      await record([{ ...GAP, term: 'Potholes' }], { domains: ['hdmap'] })
      await record([GAP], { domains: ['hdmap'] })

      const res = await app.request('/gaps')
      expect(res.status).toBe(200)
      const body = (await res.json()) as GapLogResponse
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0]).toMatchObject({
        term: 'potholes',
        count: 2,
        kinds: { unmapped: 2 },
        domains: ['hdmap'],
      })
      expect(body.entries[0]?.firstSeen).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})

describe('recordGapsWhenEnabled', () => {
  it('records nothing while FEATURE_GAP_LOG is off', async () => {
    await withEnv({ FEATURE_GAP_LOG: 'false' }, async () => {
      await recordGapsWhenEnabled([GAP], { domains: ['hdmap'] })
      expect(getGapLog().snapshot().entries).toEqual([])
    })
  })

  it('reads the flag on every call, the moment GET /gaps does', async () => {
    await withEnv({ FEATURE_GAP_LOG: 'true' }, async () => {
      await recordGapsWhenEnabled([GAP], { domains: [] })
    })
    await withEnv({ FEATURE_GAP_LOG: 'false' }, async () => {
      await recordGapsWhenEnabled([{ ...GAP, term: 'tunnels' }], { domains: [] })
    })
    expect(
      getGapLog()
        .snapshot()
        .entries.map((e) => e.term)
    ).toEqual(['potholes'])
  })

  it('is the recorder the production search service is built with', async () => {
    vi.resetModules()
    const constructed = vi.fn()
    vi.doMock('@ontology-search/llm', () => ({ generateStructuredSearch: vi.fn() }))
    vi.doMock('@ontology-search/search', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@ontology-search/search')>()),
      SearchService: vi.fn(function (this: unknown, deps: unknown) {
        constructed(deps)
      }),
    }))
    try {
      const factory =
        await vi.importActual<typeof import('../search-factory.js')>('../search-factory.js')
      const { recordGapsWhenEnabled: wired } = await import('../gap-log.js')
      factory.resetSearchService()
      await factory.getSearchService()
      expect(constructed).toHaveBeenCalledWith(expect.objectContaining({ recordGaps: wired }))
    } finally {
      vi.doUnmock('@ontology-search/llm')
      vi.doUnmock('@ontology-search/search')
      vi.resetModules()
    }
  })
})

describe('GET /gaps with a maintainer key', () => {
  const SEARCH_KEY = 'search-key'
  const GAP_KEY = 'maintainer-key'
  const keys = { FEATURE_GAP_LOG: 'true', API_KEY: SEARCH_KEY, GAP_LOG_API_KEY: GAP_KEY }

  it('refuses the search key', async () => {
    await withEnv(keys, async () => {
      const res = await (
        await freshApp()
      ).request('/gaps', {
        headers: { authorization: `Bearer ${SEARCH_KEY}` },
      })
      expect(res.status).toBe(401)
    })
  })

  it('accepts the maintainer key', async () => {
    await withEnv(keys, async () => {
      const res = await (await freshApp()).request('/gaps', { headers: { 'x-api-key': GAP_KEY } })
      expect(res.status).toBe(200)
    })
  })

  it('does not open other routes to the maintainer key', async () => {
    await withEnv(keys, async () => {
      const res = await (
        await freshApp()
      ).request('/stats', {
        headers: { 'x-api-key': GAP_KEY },
      })
      expect(res.status).toBe(401)
    })
  })

  it('does not serve the log under a trailing-slash path with the search key', async () => {
    await withEnv(keys, async () => {
      const res = await (
        await freshApp()
      ).request('/gaps/', {
        headers: { 'x-api-key': SEARCH_KEY },
      })
      expect(res.status).not.toBe(200)
    })
  })
})
