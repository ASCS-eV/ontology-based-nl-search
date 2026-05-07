import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import { InterpretationDisplay } from '../InterpretationDisplay'

describe('InterpretationDisplay', () => {
  const mockInterpretation = {
    summary: 'Looking for German motorways with exit lanes',
    mappedTerms: [
      { input: 'autobahn', mapped: 'motorway', confidence: 'high' as const, property: 'roadTypes' },
      { input: 'german', mapped: 'DE', confidence: 'high' as const, property: 'country' },
      { input: 'exit', mapped: 'exit', confidence: 'medium' as const, property: 'laneTypes' },
    ],
  }

  it('renders the summary text', () => {
    render(<InterpretationDisplay interpretation={mockInterpretation} />)
    expect(screen.getByText('Looking for German motorways with exit lanes')).toBeInTheDocument()
  })

  it('renders all mapped terms with arrows', () => {
    render(<InterpretationDisplay interpretation={mockInterpretation} />)
    expect(screen.getByText('autobahn')).toBeInTheDocument()
    expect(screen.getByText('motorway')).toBeInTheDocument()
    expect(screen.getByText('german')).toBeInTheDocument()
    expect(screen.getByText('DE')).toBeInTheDocument()
  })

  it('shows confidence badges', () => {
    render(<InterpretationDisplay interpretation={mockInterpretation} />)
    const highBadges = screen.getAllByTitle('Confidence: high')
    expect(highBadges).toHaveLength(2)
    expect(screen.getByTitle('Confidence: medium')).toBeInTheDocument()
  })

  it('shows property labels', () => {
    render(<InterpretationDisplay interpretation={mockInterpretation} />)
    expect(screen.getByText('roadTypes')).toBeInTheDocument()
    expect(screen.getByText('country')).toBeInTheDocument()
    expect(screen.getByText('laneTypes')).toBeInTheDocument()
  })

  it('renders empty state with no mapped terms', () => {
    const empty = { summary: 'No terms matched', mappedTerms: [] }
    render(<InterpretationDisplay interpretation={empty} />)
    expect(screen.getByText('No terms matched')).toBeInTheDocument()
    expect(screen.queryByText('→')).not.toBeInTheDocument()
  })

  it('has accessible region role and label', () => {
    render(<InterpretationDisplay interpretation={mockInterpretation} />)
    expect(screen.getByRole('region', { name: 'Query interpretation' })).toBeInTheDocument()
  })
})
