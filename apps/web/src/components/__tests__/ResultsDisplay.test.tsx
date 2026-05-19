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
})
