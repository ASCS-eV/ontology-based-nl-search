/**
 * The ontology gap log: per-term counts of what searches could not map, kept
 * for the ontology's maintainers without keeping anything about who asked.
 */
import type { OntologyGap } from '@ontology-search/api-types'
import { describe, expect, it } from 'vitest'

import { GapLog, MAX_GAP_TERM_CHARS, normalizeGapTerm } from '../gap-log.js'

const DAY_1 = new Date('2026-09-28T09:15:00Z')
const DAY_2 = new Date('2026-09-29T17:40:00Z')

/** A log whose clock the test moves by hand. */
function logAt(start: Date, capacity?: number): { log: GapLog; setNow: (d: Date) => void } {
  let now = start
  const log = new GapLog({ capacity, now: () => now })
  return { log, setNow: (d) => (now = d) }
}

const gap = (term: string, kind?: OntologyGap['kind']): OntologyGap => ({
  term,
  reason: 'Not a defined ontology property',
  ...(kind ? { kind } : {}),
})

describe('normalizeGapTerm', () => {
  it('trims, collapses whitespace and lower-cases, so spellings of one term count together', () => {
    expect(normalizeGapTerm('  Pot   Holes ')).toBe('pot holes')
    expect(normalizeGapTerm('SCHLAGLÖCHER')).toBe('schlaglöcher')
  })

  it('treats composed and decomposed Unicode as the same term', () => {
    expect(normalizeGapTerm('Schlaglöcher')).toBe(normalizeGapTerm('Schlaglöcher'))
  })

  it('does not record empty terms or terms longer than the cap', () => {
    expect(normalizeGapTerm('   ')).toBeUndefined()
    expect(normalizeGapTerm('x'.repeat(MAX_GAP_TERM_CHARS))).toHaveLength(MAX_GAP_TERM_CHARS)
    expect(normalizeGapTerm('x'.repeat(MAX_GAP_TERM_CHARS + 1))).toBeUndefined()
  })
})

describe('GapLog', () => {
  it('counts a term once per search, across searches, with the domains searched', () => {
    const { log } = logAt(DAY_1)
    log.record([gap('potholes')], { domains: ['hdmap'] })
    log.record([gap('Potholes')], { domains: ['hdmap', 'scenario'] })

    expect(log.snapshot().entries).toEqual([
      {
        term: 'potholes',
        count: 2,
        kinds: { unmapped: 2 },
        domains: ['hdmap', 'scenario'],
        firstSeen: '2026-09-28',
        lastSeen: '2026-09-28',
      },
    ])
  })

  it('counts a term a search reported twice once, under each kind it was given', () => {
    const { log } = logAt(DAY_1)
    log.record([gap('lane count', 'unmapped'), gap('Lane count', 'recognized')], {
      domains: ['hdmap'],
    })

    const [entry] = log.snapshot().entries
    expect(entry?.count).toBe(1)
    expect(entry?.kinds).toEqual({ unmapped: 1, recognized: 1 })
  })

  it('treats a gap without a kind as unmapped, as the wire type defines', () => {
    const { log } = logAt(DAY_1)
    log.record([gap('potholes')], { domains: [] })
    expect(log.snapshot().entries[0]?.kinds).toEqual({ unmapped: 1 })
  })

  it('keeps first and last seen at day precision, never the time of the search', () => {
    const { log, setNow } = logAt(DAY_1)
    log.record([gap('potholes')], { domains: [] })
    setNow(DAY_2)
    log.record([gap('potholes')], { domains: [] })

    const [entry] = log.snapshot().entries
    expect(entry?.firstSeen).toBe('2026-09-28')
    expect(entry?.lastSeen).toBe('2026-09-29')
  })

  it('stores nothing but the entry fields: no query text, reason or suggestions', () => {
    const { log } = logAt(DAY_1)
    log.record(
      [{ ...gap('potholes'), suggestions: ['motorway'], scopeNote: 'from "find roads near me"' }],
      { domains: ['hdmap'] }
    )
    const [entry] = log.snapshot().entries
    expect(Object.keys(entry ?? {}).sort()).toEqual(
      ['count', 'domains', 'firstSeen', 'kinds', 'lastSeen', 'term'].sort()
    )
  })

  it('ignores a search without gaps', () => {
    const { log } = logAt(DAY_1)
    log.record([], { domains: ['hdmap'] })
    expect(log.snapshot().entries).toEqual([])
  })

  it('orders by count, then most recently seen, then term', () => {
    const { log, setNow } = logAt(DAY_1)
    log.record([gap('zebra crossing'), gap('potholes')], { domains: [] })
    log.record([gap('potholes')], { domains: [] })
    log.record([gap('bridges')], { domains: [] })
    setNow(DAY_2)
    log.record([gap('tunnels')], { domains: [] })

    expect(log.snapshot().entries.map((e) => e.term)).toEqual([
      'potholes', // 2 searches
      'tunnels', // 1, seen on the later day
      'bridges', // 1, earlier day, before 'zebra crossing' by term
      'zebra crossing',
    ])
  })

  it('stays within capacity by dropping the least recently reported term', () => {
    const { log } = logAt(DAY_1, 2)
    log.record([gap('potholes')], { domains: [] })
    log.record([gap('tunnels')], { domains: [] })
    log.record([gap('potholes')], { domains: [] }) // 'tunnels' is now the least recent
    log.record([gap('bridges')], { domains: [] })

    const snapshot = log.snapshot()
    expect(snapshot.capacity).toBe(2)
    expect(snapshot.entries.map((e) => e.term)).toEqual(['potholes', 'bridges'])
  })

  it('reading a snapshot does not change which term is dropped next', () => {
    const { log } = logAt(DAY_1, 2)
    log.record([gap('potholes')], { domains: [] })
    log.record([gap('tunnels')], { domains: [] })
    log.snapshot()
    log.record([gap('bridges')], { domains: [] })

    expect(log.snapshot().entries.map((e) => e.term)).toEqual(['bridges', 'tunnels'])
  })
})
