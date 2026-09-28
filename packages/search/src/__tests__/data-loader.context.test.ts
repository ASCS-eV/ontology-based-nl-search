import { describe, expect, it } from 'vitest'

import { contextUrlCandidates } from '../data-loader.js'

describe('contextUrlCandidates', () => {
  it('keeps exact and trailing-slash variants of a plain context URL', () => {
    expect(contextUrlCandidates('https://example.org/onto/v1/')).toEqual([
      'https://example.org/onto/v1/',
      'https://example.org/onto/v1//',
      'https://example.org/onto/v1',
    ])
  })

  it.each(['https://example.org/onto/v1/context', 'https://example.org/onto/v1#context'])(
    'maps the catalog form %s to the ontology base IRI a local context is indexed by',
    (url) => {
      const candidates = contextUrlCandidates(url)
      expect(candidates).toContain('https://example.org/onto/v1/')
      expect(candidates).toContain('https://example.org/onto/v1')
    }
  )

  it('does not strip "context" when it is only part of a path segment', () => {
    expect(contextUrlCandidates('https://example.org/mycontext')).not.toContain(
      'https://example.org/my'
    )
  })
})
