/**
 * The evaluation harness must never be stricter than the production agent.
 *
 * Regression: the harness re-declared the slot schema and required every range
 * to carry `min` or `max`. A model naming a range property without committing
 * to a bound produced a submission production accepts and the harness threw
 * on — aborting the whole run at that sample, with no summary written.
 */
import { slotSubmissionSchema } from '@ontology-search/llm/evaluation'
import { describe, expect, it } from 'vitest'

import { SearchSlotsSchema } from '../types.js'

const submissionWithUnboundedRange = {
  slots: { domains: ['hdmap'], filters: {}, ranges: { laneCount: {} } },
  interpretation: { summary: 'unbounded range', mappedTerms: [] },
  gaps: [],
}

describe('slot contract parity', () => {
  it('accepts every submission shape the production agent accepts', () => {
    const production = slotSubmissionSchema.safeParse(submissionWithUnboundedRange)
    expect(production.success).toBe(true)

    const harness = SearchSlotsSchema.safeParse(production.success ? production.data.slots : null)
    expect(harness.success).toBe(true)
  })

  it('preserves an empty range rather than dropping or rejecting it', () => {
    const parsed = SearchSlotsSchema.parse({ ranges: { laneCount: {} } })
    expect(parsed.ranges).toEqual({ laneCount: {} })
    expect(parsed.domains).toEqual([])
    expect(parsed.filters).toEqual({})
  })

  it('carries the reference `label` the production wire schema allows', () => {
    const parsed = SearchSlotsSchema.parse({
      references: { domain: 'hdmap', label: 'referenced map' },
    })
    expect(parsed.references).toEqual({ domain: 'hdmap', label: 'referenced map' })
  })
})
