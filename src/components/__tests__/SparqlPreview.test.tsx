import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'

import { SparqlPreview } from '../SparqlPreview'

describe('SparqlPreview', () => {
  const mockSparql = `SELECT ?asset ?name WHERE {
  ?asset a hdmap:HdMap ;
    rdfs:label ?name .
}`

  it('renders collapsed by default', () => {
    render(<SparqlPreview sparql={mockSparql} />)
    expect(screen.getByText('Show generated SPARQL query')).toBeInTheDocument()
    expect(screen.queryByText(mockSparql)).not.toBeInTheDocument()
  })

  it('expands to show SPARQL on click', () => {
    render(<SparqlPreview sparql={mockSparql} />)
    fireEvent.click(screen.getByText('Show generated SPARQL query'))
    expect(screen.getByText(/SELECT \?asset \?name WHERE/)).toBeInTheDocument()
    expect(screen.getByText('Hide generated SPARQL query')).toBeInTheDocument()
  })

  it('collapses on second click', () => {
    render(<SparqlPreview sparql={mockSparql} />)
    const toggle = screen.getByText('Show generated SPARQL query')
    fireEvent.click(toggle)
    fireEvent.click(screen.getByText('Hide generated SPARQL query'))
    expect(screen.queryByText(mockSparql)).not.toBeInTheDocument()
  })

  it('has proper aria-expanded attribute', () => {
    render(<SparqlPreview sparql={mockSparql} />)
    const toggle = screen.getByRole('button', { name: /SPARQL query/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows copy button when expanded', () => {
    render(<SparqlPreview sparql={mockSparql} />)
    fireEvent.click(screen.getByText('Show generated SPARQL query'))
    expect(screen.getByRole('button', { name: 'Copy SPARQL query' })).toBeInTheDocument()
  })
})
