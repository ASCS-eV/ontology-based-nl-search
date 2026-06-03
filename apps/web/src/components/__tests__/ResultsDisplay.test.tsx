import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as exportUtils from '../../lib/export-utils'
import { ResultsDisplay } from '../ResultsDisplay'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ResultsDisplay', () => {
  it('renders the empty state when results is an empty array', () => {
    render(<ResultsDisplay results={[]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/no results found/i)).toBeInTheDocument()
  })

  it('renders a table with one row per result and one column per key', () => {
    render(
      <ResultsDisplay
        results={[
          { asset: 'urn:test:1', name: 'Highway A99' },
          { asset: 'urn:test:2', name: 'Urban Munich' },
        ]}
      />
    )

    const region = screen.getByRole('region', { name: /search results/i })
    expect(within(region).getByText('2 matches')).toBeInTheDocument()
    expect(within(region).getByText('Highway A99')).toBeInTheDocument()
    expect(within(region).getByText('Urban Munich')).toBeInTheDocument()
  })

  it('says "1 match" (singular) for one result', () => {
    render(<ResultsDisplay results={[{ asset: 'urn:test:1' }]} />)
    expect(screen.getByText('1 match')).toBeInTheDocument()
  })

  /**
   * Clicking the CSV / JSON-LD buttons must call the export helpers with
   * the actual result set — not stub data. Spy on the helper module so we
   * can assert without actually downloading anything (jsdom has no real
   * download capability).
   */
  it('CSV export wires through to resultsToCsv + downloadFile', async () => {
    const csvSpy = vi.spyOn(exportUtils, 'resultsToCsv').mockReturnValue('a,b\n1,2')
    const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {})
    const user = userEvent.setup()

    const results = [{ asset: 'urn:test:1', name: 'A' }]
    render(<ResultsDisplay results={results} />)

    await user.click(screen.getByRole('button', { name: /export results as csv/i }))

    expect(csvSpy).toHaveBeenCalledWith(results, ['asset', 'name'])
    expect(downloadSpy).toHaveBeenCalledWith('a,b\n1,2', 'search-results.csv', 'text/csv')
  })

  it('JSON-LD export wires through to resultsToJsonLd + downloadFile', async () => {
    const jsonLdSpy = vi.spyOn(exportUtils, 'resultsToJsonLd').mockReturnValue({ '@graph': [] })
    const downloadSpy = vi.spyOn(exportUtils, 'downloadFile').mockImplementation(() => {})
    const user = userEvent.setup()

    const results = [{ asset: 'urn:test:1' }]
    render(<ResultsDisplay results={results} />)

    await user.click(screen.getByRole('button', { name: /export results as json-ld/i }))

    expect(jsonLdSpy).toHaveBeenCalledWith(results)
    expect(downloadSpy).toHaveBeenCalledWith(
      JSON.stringify({ '@graph': [] }, null, 2),
      'search-results.jsonld',
      'application/ld+json'
    )
  })

  it('renders grouped card layout when results contain references', () => {
    const results = [
      {
        asset: 'did:web:example.com:Trace:1',
        name: 'Munich Trace',
        refAsset: 'did:web:example.com:HdMap:1',
        refName: 'Munich HD Map',
      },
      {
        asset: 'did:web:example.com:Trace:1',
        name: 'Munich Trace',
        refAsset: 'did:web:example.com:HdMap:2',
        refName: 'Munich Urban Map',
      },
      {
        asset: 'did:web:example.com:Trace:2',
        name: 'Berlin Trace',
        refAsset: 'did:web:example.com:HdMap:3',
        refName: 'Berlin HD Map',
      },
    ]
    render(<ResultsDisplay results={results} />)

    // Should show 2 grouped matches (not 3 flat rows)
    expect(screen.getByText('2 matches')).toBeInTheDocument()
    // Card titles
    expect(screen.getByText('Munich Trace')).toBeInTheDocument()
    expect(screen.getByText('Berlin Trace')).toBeInTheDocument()
    // Reference chips
    expect(screen.getByText('Munich HD Map')).toBeInTheDocument()
    expect(screen.getByText('Munich Urban Map')).toBeInTheDocument()
    expect(screen.getByText('Berlin HD Map')).toBeInTheDocument()
    // Reference count labels
    expect(screen.getByText('References (2)')).toBeInTheDocument()
    expect(screen.getByText('References (1)')).toBeInTheDocument()
  })

  /**
   * Multi-reference search (PR #47 made `references` a list): the compiler
   * projects `refAsset`/`refName` for the first referenced domain and
   * `refAsset1`/`refName1`, … for the rest. Every referenced asset must
   * render — regression for the "only the first reference was displayed" gap.
   */
  it('renders every referenced asset across multiple reference domains', () => {
    const results = [
      {
        asset: 'did:web:x:Scenario:1',
        name: 'Munich Scenario',
        refAsset: 'did:web:x:OSITrace:1',
        refName: 'Munich Trace',
        refAsset1: 'did:web:x:HdMap:1',
        refName1: 'Munich HD Map',
      },
    ]
    render(<ResultsDisplay results={results} />)
    expect(screen.getByText('Munich Trace')).toBeInTheDocument()
    expect(screen.getByText('Munich HD Map')).toBeInTheDocument()
    // Both references counted on the one card.
    expect(screen.getByText('References (2)')).toBeInTheDocument()
    // The suffixed ref columns must not leak into the property grid.
    expect(screen.queryByText('refAsset1')).not.toBeInTheDocument()
    expect(screen.queryByText('refName1')).not.toBeInTheDocument()
  })

  it('deduplicates references within the same asset group', () => {
    const results = [
      {
        asset: 'did:web:x:Trace:1',
        name: 'Trace A',
        refAsset: 'did:web:x:Map:1',
        refName: 'Map One',
      },
      {
        asset: 'did:web:x:Trace:1',
        name: 'Trace A',
        refAsset: 'did:web:x:Map:1',
        refName: 'Map One',
      },
    ]
    render(<ResultsDisplay results={results} />)

    // Only 1 unique match
    expect(screen.getByText('1 match')).toBeInTheDocument()
    // Only 1 reference chip (deduplicated)
    expect(screen.getByText('References (1)')).toBeInTheDocument()
  })

  /**
   * Label-cluster dedup: when one asset references multiple distinct
   * resources that share an `rdfs:label` (common with map tiles —
   * "Cologne Motorway HD Map" repeats across several IRIs), collapse
   * the pills into ONE pill with an `×N` count badge. Every IRI is
   * preserved in the `title` attribute for hover inspection.
   */
  it('collapses references sharing a display label into a single pill with an ×N count', () => {
    const results = [
      {
        asset: 'did:web:x:Trace:1',
        name: 'Trace A',
        refAsset: 'did:web:x:HdMap:1',
        refName: 'Cologne Motorway HD Map',
      },
      {
        asset: 'did:web:x:Trace:1',
        name: 'Trace A',
        refAsset: 'did:web:x:HdMap:2',
        refName: 'Cologne Motorway HD Map',
      },
      {
        asset: 'did:web:x:Trace:1',
        name: 'Trace A',
        refAsset: 'did:web:x:HdMap:3',
        refName: 'Cologne Motorway HD Map',
      },
    ]
    render(<ResultsDisplay results={results} />)
    // The card-level count still reflects the underlying refs.
    expect(screen.getByText('References (3)')).toBeInTheDocument()
    // ONE pill, not three.
    const pills = screen.getAllByText('Cologne Motorway HD Map')
    expect(pills).toHaveLength(1)
    // The ×N badge surfaces the cluster size.
    expect(screen.getByText('×3')).toBeInTheDocument()
    // All three IRIs are reachable via the pill's `title` attribute.
    const pill = pills[0]!.closest('span[title]')
    expect(pill?.getAttribute('title')).toContain('did:web:x:HdMap:1')
    expect(pill?.getAttribute('title')).toContain('did:web:x:HdMap:2')
    expect(pill?.getAttribute('title')).toContain('did:web:x:HdMap:3')
  })

  /**
   * Traceability breadcrumb: when the per-row `traceability` array is
   * supplied alongside `results`, the reference must carry an inline
   * predicate-chain breadcrumb (WP3, task #18). Each step renders its
   * IRI's local name with the full IRI in `title` for hover inspection.
   */
  it('renders a traceability breadcrumb under each reference when trace data is supplied', () => {
    const results = [
      {
        asset: 'urn:scenario:1',
        name: 'Scenario 1',
        refAsset: 'urn:hdmap:42',
        refName: 'Munich HD Map',
      },
    ]
    const traceability = [
      [
        {
          predicate: 'https://example.org/scenario/v6/hasManifest',
          intermediate: '_:b0',
        },
        {
          predicate: 'https://example.org/manifest/v5/hasReferencedArtifacts',
          intermediate: '_:b1',
        },
        {
          predicate: 'https://example.org/manifest/v5/iri',
          intermediate: 'urn:hdmap:42',
        },
      ],
    ]
    render(<ResultsDisplay results={results} traceability={traceability} />)
    // Breadcrumb roots at the primary `asset`.
    expect(screen.getByText('asset')).toBeInTheDocument()
    // Each step renders its predicate's local name (the post-`/` suffix).
    expect(screen.getByText('hasManifest')).toBeInTheDocument()
    expect(screen.getByText('hasReferencedArtifacts')).toBeInTheDocument()
    expect(screen.getByText('iri')).toBeInTheDocument()
    // Full IRI lives in the hover title.
    expect(screen.getByText('hasManifest').getAttribute('title')).toBe(
      'https://example.org/scenario/v6/hasManifest'
    )
  })

  /**
   * Defensive: without trace data, the references list still renders.
   * Traceability is purely additive.
   */
  it('omits the breadcrumb when no traceability data is supplied', () => {
    const results = [
      {
        asset: 'urn:scenario:1',
        name: 'Scenario 1',
        refAsset: 'urn:hdmap:42',
        refName: 'Munich HD Map',
      },
    ]
    render(<ResultsDisplay results={results} />)
    expect(screen.queryByText('asset')).not.toBeInTheDocument()
    expect(screen.getByText('Munich HD Map')).toBeInTheDocument()
  })
})
