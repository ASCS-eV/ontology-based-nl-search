import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import { ResultsDisplay } from '../ResultsDisplay'

describe('ResultsDisplay', () => {
  const mockResults = [
    { asset: 'https://example.org/asset1', name: 'Highway A3', country: 'DE' },
    { asset: 'https://example.org/asset2', name: 'Autobahn A7', country: 'DE' },
  ]

  it('shows empty state when results array is empty', () => {
    render(<ResultsDisplay results={[]} />)
    expect(screen.getByText('No results found for your query.')).toBeInTheDocument()
    expect(screen.getByText(/Try broadening your search/)).toBeInTheDocument()
  })

  it('renders results count', () => {
    render(<ResultsDisplay results={mockResults} />)
    expect(screen.getByText('2 matches')).toBeInTheDocument()
  })

  it('renders singular "match" for one result', () => {
    render(<ResultsDisplay results={[mockResults[0]!]} />)
    expect(screen.getByText('1 match')).toBeInTheDocument()
  })

  it('renders table with correct columns', () => {
    render(<ResultsDisplay results={mockResults} />)
    expect(screen.getByText('asset')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('country')).toBeInTheDocument()
  })

  it('renders data values in table cells', () => {
    render(<ResultsDisplay results={mockResults} />)
    expect(screen.getByText('Highway A3')).toBeInTheDocument()
    expect(screen.getByText('Autobahn A7')).toBeInTheDocument()
  })

  it('formats URIs to show only last segment', () => {
    render(<ResultsDisplay results={mockResults} />)
    expect(screen.getByText('asset1')).toBeInTheDocument()
    expect(screen.queryByText('https://example.org/asset1')).not.toBeInTheDocument()
  })

  it('renders export buttons', () => {
    render(<ResultsDisplay results={mockResults} />)
    expect(screen.getByRole('button', { name: 'Export results as CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export results as JSON-LD' })).toBeInTheDocument()
  })

  it('has accessible region role', () => {
    render(<ResultsDisplay results={mockResults} />)
    expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument()
  })
})
