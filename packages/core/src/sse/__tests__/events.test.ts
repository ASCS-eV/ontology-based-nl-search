/**
 * Pin the SSE event-name wire contract. Producers (api/routes/search)
 * and consumers (web/components/SearchPage) both read from the same
 * SSE_EVENT map; these tests prove the values are exactly what the
 * wire format requires.
 */

import { describe, expect, it } from 'vitest'

import { SSE_EVENT, type SseEventName } from '../events.js'

describe('SSE_EVENT', () => {
  it('exposes the canonical event names emitted by /search/stream and /author/stream', () => {
    expect(SSE_EVENT).toEqual({
      STATUS: 'status',
      INTERPRETATION: 'interpretation',
      GAPS: 'gaps',
      SCENE: 'scene',
      XOSC: 'xosc',
      VALIDATION: 'validation',
      SPARQL: 'sparql',
      GRAPHQL: 'graphql',
      RESULTS: 'results',
      META: 'meta',
      DONE: 'done',
      ERROR: 'error',
    })
  })

  it('has a type that admits every value', () => {
    const values: SseEventName[] = Object.values(SSE_EVENT)
    expect(values).toHaveLength(12)
  })
})
