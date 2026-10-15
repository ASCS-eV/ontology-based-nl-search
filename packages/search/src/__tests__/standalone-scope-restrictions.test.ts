/**
 * A standalone vocabulary in scope adds arms for documents of that
 * vocabulary; it never takes a restriction away from the asset domains.
 *
 * A standalone document references nothing. With a reference — an explicit
 * one, or the JOIN a parent→child hierarchy compiles to — it therefore
 * contributes no arm, and the asset domains compile exactly as without it.
 */
import type { SearchSlots } from '@ontology-search/slots/slots'
import { describe, expect, it } from 'vitest'

import { compileSlotsWithTrace } from '../compiler.js'
import { getInitializedStore } from '../init.js'

const VOCABULARY = 'openlabel'

const withVocabulary = (slots: SearchSlots): SearchSlots => ({
  ...slots,
  domains: [...slots.domains, VOCABULARY],
})

async function assetsOf(sparql: string): Promise<string[]> {
  const store = await getInitializedStore()
  const rows = (await store.query(sparql)).results.bindings
  return [...new Set(rows.map((row) => row['asset']?.value ?? ''))].sort()
}

describe('a standalone vocabulary in scope', () => {
  it('keeps an explicit reference and its restriction', async () => {
    const slots: SearchSlots = {
      domains: ['scenario'],
      filters: { MotionCutIn: 'true' },
      ranges: {},
      references: [{ domain: 'hdmap', filters: { country: 'XX' } }],
    }
    const plain = await compileSlotsWithTrace(slots)
    const scoped = await compileSlotsWithTrace(withVocabulary(slots))

    expect(scoped.sparql).toBe(plain.sparql)
    expect(scoped.droppedReferences).toEqual(plain.droppedReferences)
    // No HD map is in country XX.
    expect(await assetsOf(scoped.sparql)).toEqual([])
  }, 120_000)

  it('keeps the JOIN a constraint only the referenced domain can express needs', async () => {
    // Lane types are an HD-map property the scenario cannot express, so the
    // scenario → HD map reference becomes a JOIN.
    const slots: SearchSlots = {
      domains: ['hdmap', 'scenario'],
      filters: { roadTypes: 'motorway', laneTypes: 'driving' },
      ranges: {},
    }
    const plain = await compileSlotsWithTrace(slots)
    expect(plain.sparql).not.toContain('UNION')

    const scoped = await compileSlotsWithTrace(withVocabulary(slots))
    expect(scoped.sparql).toBe(plain.sparql)
  }, 120_000)

  it('compiles a reference on the vocabulary alone to an explicit empty result', async () => {
    const { sparql } = await compileSlotsWithTrace({
      domains: [VOCABULARY],
      filters: {},
      ranges: {},
      references: [{ domain: 'hdmap' }],
    })
    expect(sparql).toContain('FILTER(false)')
    expect(await assetsOf(sparql)).toEqual([])
  }, 120_000)
})
