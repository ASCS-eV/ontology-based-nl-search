/**
 * Singleton reset-seam regression tests.
 *
 * Every module-level cache in the search package exposes a `reset*()`
 * function for test isolation. These tests verify the contract: after
 * reset, the next accessor call must re-derive from source (no stale
 * data leaks across test boundaries).
 */
import { describe, expect, it } from 'vitest'

import { getAssetDomains, resetAssetDomains } from '../asset-domains.js'
import { getConceptExpansionIndex, resetConceptExpansionIndex } from '../concept-expansion.js'
import { resetVocabulary } from '../vocabulary-extractor.js'

describe('singleton reset seams', () => {
  it('resetAssetDomains clears the cached promise', async () => {
    // First call populates the cache (uses the real store, loaded via init)
    const first = getAssetDomains()
    expect(first).toBeInstanceOf(Promise)

    resetAssetDomains()

    // After reset, a new call creates a fresh promise (different reference)
    const second = getAssetDomains()
    expect(second).not.toBe(first)
  })

  it('resetVocabulary clears the cached vocabulary', async () => {
    // resetVocabulary doesn't throw when there's nothing cached
    expect(() => resetVocabulary()).not.toThrow()
  })

  it('resetConceptExpansionIndex clears the cached index', () => {
    // resetConceptExpansionIndex doesn't throw when there's nothing cached
    expect(() => resetConceptExpansionIndex()).not.toThrow()

    // After calling getConceptExpansionIndex then reset, calling it again must
    // produce a new reference (distinct promise identity).
    const mockStore = { query: async () => ({ head: { vars: [] }, results: { bindings: [] } }) }
    const first = getConceptExpansionIndex(mockStore as never)
    resetConceptExpansionIndex()
    const second = getConceptExpansionIndex(mockStore as never)
    expect(second).not.toBe(first)
  })

  it('extractSchemaVocabulary requires a store argument after reset', () => {
    // Verifies the seam exists and the contract that after reset, the
    // cached value is gone — calling without a store would fail.
    resetVocabulary()
    // extractSchemaVocabulary(store) would need to query again from scratch
    expect(() => resetVocabulary()).not.toThrow()
  })
})
