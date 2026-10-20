/**
 * `contextChars` accounting: the evaluation trace must report what the
 * model is actually sent, not a re-derivation of it.
 */
import type { DomainCard, RetrievedSchema } from '@ontology-search/search'
import { describe, expect, it } from 'vitest'

import { composeRetrievedSections } from '../../prompt/compose.js'
import { summarizeRetrieval } from '../evaluation-types.js'

const entry = (domain: string, propertyNames: string[]): DomainCard => ({
  domain,
  classLabels: [`${domain} Asset`],
  sampleTerms: propertyNames.slice(0, 2),
  propertyNames,
})

const base: RetrievedSchema = {
  domains: ['alpha'],
  cards: [
    {
      kind: 'property',
      iri: 'urn:x:speedLimit',
      localName: 'speedLimit',
      domain: 'alpha',
      labels: ['speed limit'],
    },
  ],
  fragments: [],
  confidence: 0.8,
  catalog: [entry('alpha', ['speedLimit', 'country'])],
}

describe('summarizeRetrieval', () => {
  it('reports the composed tail length, byte for byte', () => {
    expect(summarizeRetrieval(base).contextChars).toBe(composeRetrievedSections(base).length)
  })

  /**
   * Regression: a parts-sum over the whole catalog counts every domain's
   * properties, but the composer details only the domains the query routed
   * to. On the shipped ontology that inflated the figure several-fold,
   * which silently rewards a retrieval change for shrinking a number the
   * model never saw.
   */
  it('ignores catalog domains the query did not route to', () => {
    const withExtraDomain: RetrievedSchema = {
      ...base,
      catalog: [
        ...base.catalog,
        entry(
          'beta',
          Array.from({ length: 500 }, (_, i) => `beta${i}`)
        ),
      ],
    }
    const grew = summarizeRetrieval(withExtraDomain).contextChars
    const baseline = summarizeRetrieval(base).contextChars
    // Only the one catalog line the composer actually renders for it.
    expect(grew - baseline).toBeLessThan(100)
  })

  /**
   * Regression: a name already shown as a card is not repeated in the
   * roster, so counting the catalog's property names double-counts it.
   */
  it('does not count a property both as a card and as a roster name', () => {
    const carded = summarizeRetrieval(base).contextChars
    const uncarded = summarizeRetrieval({ ...base, cards: [], domains: ['alpha'] }).contextChars
    expect(carded).not.toBe(uncarded)
    expect(composeRetrievedSections(base)).not.toMatch(
      /not retrieved for this query: [^\n]*speedLimit/
    )
  })
})
