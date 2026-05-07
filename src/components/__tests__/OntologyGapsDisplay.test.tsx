import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import { OntologyGapsDisplay } from '../OntologyGapsDisplay'

describe('OntologyGapsDisplay', () => {
  const mockGaps = [
    {
      term: 'highway exit',
      reason: 'Not a recognized road type in the HD map ontology',
      suggestions: ['intersection', 'junction'],
    },
    {
      term: 'roundabout',
      reason: 'Road feature not modeled in current ontology version',
      suggestions: [],
    },
  ]

  it('renders nothing when gaps array is empty', () => {
    const { container } = render(<OntologyGapsDisplay gaps={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders all gaps with terms and reasons', () => {
    render(<OntologyGapsDisplay gaps={mockGaps} />)
    expect(screen.getByText(/highway exit/)).toBeInTheDocument()
    expect(screen.getByText(/Not a recognized road type/)).toBeInTheDocument()
    expect(screen.getByText(/roundabout/)).toBeInTheDocument()
  })

  it('shows suggestions when available', () => {
    render(<OntologyGapsDisplay gaps={mockGaps} />)
    expect(screen.getByText('intersection')).toBeInTheDocument()
    expect(screen.getByText('junction')).toBeInTheDocument()
  })

  it('renders "Nearest concepts:" label only for gaps with suggestions', () => {
    render(<OntologyGapsDisplay gaps={mockGaps} />)
    const labels = screen.getAllByText('Nearest concepts:')
    expect(labels).toHaveLength(1)
  })

  it('has accessible region role and label', () => {
    render(<OntologyGapsDisplay gaps={mockGaps} />)
    expect(screen.getByRole('region', { name: 'Ontology gaps' })).toBeInTheDocument()
  })

  it('displays the "Not in ontology" heading', () => {
    render(<OntologyGapsDisplay gaps={mockGaps} />)
    expect(screen.getByText('Not in ontology')).toBeInTheDocument()
  })
})
