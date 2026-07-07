/**
 * Unit tests for the shared empty-slot fallback.
 *
 * Pins the genericity contract: the "couldn't extract filters" hint draws its
 * example property names from the LIVE vocabulary, never the hardcoded
 * ENVITED-X demo predicates (`roadTypes`/`scenarioCategory`) the inline
 * fallbacks previously embedded in both agents.
 */
import type { SchemaVocabulary } from '@ontology-search/search'
import { describe, expect, it, vi } from 'vitest'

// Mock the compiler so the helper doesn't need a real schema graph / store.
vi.mock('@ontology-search/search/compiler', () => ({
  compileSlots: vi.fn().mockResolvedValue('SELECT ?asset WHERE { ?asset ?p ?o }'),
}))

import { buildEmptyFallbackResponse } from '../empty-fallback.js'

function vocab(partial: Partial<SchemaVocabulary>): SchemaVocabulary {
  return {
    enumProperties: [],
    numericProperties: [],
    domains: [],
    conceptSchemes: new Map(),
    classHierarchy: [],
    instanceValues: new Map(),
    ...partial,
  }
}

describe('buildEmptyFallbackResponse', () => {
  it('derives example property names from the live vocabulary', async () => {
    const v = vocab({
      enumProperties: [
        {
          iri: 'urn:x#genre',
          localName: 'genre',
          label: '',
          description: '',
          allowedValues: [],
          domain: 'library',
        },
      ],
      numericProperties: [
        {
          iri: 'urn:x#pageCount',
          localName: 'pageCount',
          label: '',
          description: '',
          datatype: 'integer',
          domain: 'library',
        },
      ],
    })

    const res = await buildEmptyFallbackResponse('books about dragons', v)
    const reason = res.gaps[0]?.reason ?? ''

    expect(reason).toContain('genre')
    expect(reason).toContain('pageCount')
    expect(reason).not.toContain('roadTypes')
    expect(reason).not.toContain('scenarioCategory')
    expect(res.gaps[0]?.term).toBe('books about dragons')
    expect(res.sparql).toContain('SELECT')
  })

  it('falls back to a generic, property-free hint when the vocabulary is empty', async () => {
    const res = await buildEmptyFallbackResponse('q', vocab({}))
    const reason = res.gaps[0]?.reason ?? ''

    expect(reason).toContain('concrete property names from the ontology')
    expect(reason).not.toContain('e.g.')
    expect(reason).not.toContain('roadTypes')
  })

  it('caps the example list and de-duplicates', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      iri: `urn:x#p${i}`,
      localName: `p${i}`,
      label: '',
      description: '',
      allowedValues: [],
      domain: 'd',
    }))
    const res = await buildEmptyFallbackResponse('q', vocab({ enumProperties: many }))
    const reason = res.gaps[0]?.reason ?? ''
    // Only the first 3 example names are surfaced.
    expect(reason).toContain('p0')
    expect(reason).toContain('p2')
    expect(reason).not.toContain('p3')
  })
})
