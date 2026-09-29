/**
 * `GET /gaps`: the ontology gap log is opt-in, and while on it serves the
 * per-term counts the search service recorded.
 */
import type { GapLogResponse } from '@ontology-search/api-types'
import { getConfig, resetConfig } from '@ontology-search/core/config'
import { ERROR_CODE } from '@ontology-search/core/errors'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '../app.js'
import { gapLogRecorder, resetGapLog } from '../gap-log.js'

// The routes under test never reach the search pipeline or the authoring
// engine; mock them so importing the app loads neither the LLM nor the WASM.
vi.mock('../search-factory.js', () => ({ searchNl: vi.fn(), searchRefine: vi.fn() }))
vi.mock('@ontology-search/llm/authoring', () => ({
  runSceneAgent: vi.fn(),
  runScenePipeline: vi.fn(),
}))

/** Run `fn` with FEATURE_GAP_LOG set, restoring the environment afterwards. */
async function withGapLog<T>(value: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.FEATURE_GAP_LOG
  process.env.FEATURE_GAP_LOG = value
  resetConfig()
  try {
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.FEATURE_GAP_LOG
    else process.env.FEATURE_GAP_LOG = previous
    resetConfig()
  }
}

afterEach(() => {
  resetGapLog()
})

describe('GET /gaps', () => {
  it('is off by default and answers 404', async () => {
    expect(getConfig().FEATURE_GAP_LOG).toBe(false)
    const res = await app.request('/gaps')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: 'The gap log is not enabled',
      code: ERROR_CODE.NOT_FOUND,
    })
  })

  it('records nothing while off', () => {
    expect(gapLogRecorder(false)).toBeUndefined()
  })

  it('serves what searches recorded while on', async () => {
    await withGapLog('true', async () => {
      const record = gapLogRecorder(getConfig().FEATURE_GAP_LOG)
      expect(record).toBeDefined()
      record?.([{ term: 'Potholes', reason: 'Not a defined ontology property' }], {
        domains: ['hdmap'],
      })
      record?.([{ term: 'potholes', reason: 'Not a defined ontology property' }], {
        domains: ['hdmap'],
      })

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
      expect(body.capacity).toBeGreaterThan(0)
    })
  })
})
