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

  it('renders "Related concepts:" label only for gaps with suggestions', () => {
    render(<OntologyGapsDisplay gaps={mockGaps} />)
    const labels = screen.getAllByText('Related concepts:')
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

  it('shows domain concept badge and definition when available', () => {
    const gapsWithGlossary = [
      {
        term: 'intersection',
        reason: 'Recognized domain concept but not a filterable property',
        suggestions: ['town', 'townArterial'],
        definition: 'A point where two or more roads meet or cross.',
        scopeNote: 'Use town road type to find maps with intersections.',
        isDomainConcept: true,
      },
    ]
    render(<OntologyGapsDisplay gaps={gapsWithGlossary} />)
    expect(screen.getByText('Domain concept')).toBeInTheDocument()
    expect(screen.getByText(/two or more roads/)).toBeInTheDocument()
    expect(screen.getByText(/Use town road type/)).toBeInTheDocument()
  })
})
