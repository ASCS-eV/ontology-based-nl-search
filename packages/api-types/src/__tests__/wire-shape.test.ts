/**
 * Pin the HTTP wire shapes. The tests below treat each exported
 * interface as a contract a real JSON response could be assigned into
 * — if the structure drifts, TypeScript will reject the assignment at
 * compile time and the runtime `expect` will still surface the change.
 *
 * No ontology-specific names appear here; the assertions use synthetic
 * values so the contract is independent of which schema is loaded.
 */

import { describe, expect, it } from 'vitest'

import type {
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
  ResultRow,
  SearchMeta,
  SearchResponse,
  StatsResponse,
  TimingEntry,
} from '../index.js'

describe('@ontology-search/api-types — wire shape', () => {
  it('accepts a complete SearchResponse shape', () => {
    const term: MappedTerm = {
      input: 'opaque user input',
      mapped: 'opaque mapped value',
      confidence: 'high',
      property: 'opaque:property',
    }
    const interpretation: QueryInterpretation = {
      summary: 'opaque summary',
      mappedTerms: [term],
      domains: ['hdmap'],
      // Task 21d-flat: geographic / license fields live in
      // `appliedFilters` keyed by SHACL leaf local name — there is no
      // separate `appliedLocation` field on the wire.
      appliedFilters: {
        roadTypes: 'motorway',
        laneTypes: ['driving', 'exit'],
        country: 'DE',
      },
    }
    const gap: OntologyGap = {
      term: 'unknown term',
      reason: 'why it was unknown',
      suggestions: ['s1', 's2'],
      definition: 'a definition',
      scopeNote: 'a scope note',
      isDomainConcept: true,
    }
    const timing: TimingEntry = { stage: 'phase-name', durationMs: 12 }
    const meta: SearchMeta = {
      requestId: 'req_test',
      totalDatasets: 100,
      matchCount: 7,
      executionTimeMs: 42,
      timings: [timing],
    }
    const row: ResultRow = { col: 'value' }
    const response: SearchResponse = {
      interpretation,
      gaps: [gap],
      sparql: 'SELECT * WHERE { ?s ?p ?o }',
      results: [row],
      meta,
    }
    expect(response.interpretation.mappedTerms[0]?.confidence).toBe('high')
    expect(response.meta.requestId).toBe('req_test')
    expect(response.meta.timings?.[0]?.durationMs).toBe(12)
  })

  it('accepts a StatsResponse shape', () => {
    const stats: StatsResponse = {
      totalAssets: 123,
      domains: { a: 10, b: 20 },
      availableDomains: ['a', 'b'],
    }
    expect(stats.totalAssets).toBe(123)
    expect(stats.availableDomains).toHaveLength(2)
  })

  it('treats optional fields as actually optional', () => {
    // Minimal MappedTerm — no `property`.
    const minimalTerm: MappedTerm = {
      input: 'i',
      mapped: 'm',
      confidence: 'low',
    }
    // Minimal OntologyGap — only the two required fields.
    const minimalGap: OntologyGap = { term: 't', reason: 'r' }
    // Minimal SearchMeta — no `timings`.
    const minimalMeta: SearchMeta = {
      requestId: 'req_test',
      totalDatasets: 0,
      matchCount: 0,
      executionTimeMs: 0,
    }
    expect(minimalTerm.confidence).toBe('low')
    expect(minimalGap.term).toBe('t')
    expect(minimalMeta.timings).toBeUndefined()
  })
})
