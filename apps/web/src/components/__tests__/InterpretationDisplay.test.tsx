import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithDesignSystem as render } from '../../test-utils'
import { InterpretationDisplay } from '../InterpretationDisplay'

const baseInterpretation = {
  summary: 'find all motorways in Germany',
  mappedTerms: [
    {
      input: 'motorway',
      mapped: 'motorway',
      confidence: 'high' as const,
      property: 'roadTypes',
    },
    {
      input: 'Germany',
      mapped: 'DE',
      confidence: 'medium' as const,
      property: 'country',
    },
  ],
}

describe('InterpretationDisplay', () => {
  it('renders the summary and every mapped term', () => {
    render(<InterpretationDisplay interpretation={baseInterpretation} />)

    expect(screen.getByText(baseInterpretation.summary)).toBeInTheDocument()
    // 'motorway' appears twice (input + mapped, both literally the same).
    expect(screen.getAllByText('motorway').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('DE')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
  })

  it('renders one confidence badge per mapped term', () => {
    render(<InterpretationDisplay interpretation={baseInterpretation} />)
    // Each badge has a title="Confidence: …" attribute we can target.
    expect(screen.getByTitle('Confidence: high')).toBeInTheDocument()
    expect(screen.getByTitle('Confidence: medium')).toBeInTheDocument()
  })

  it('renders the property hint when present', () => {
    render(<InterpretationDisplay interpretation={baseInterpretation} />)
    expect(screen.getByText('roadTypes')).toBeInTheDocument()
    expect(screen.getByText('country')).toBeInTheDocument()
  })

  it('renders only the summary when mappedTerms is empty', () => {
    render(<InterpretationDisplay interpretation={{ summary: 'no terms', mappedTerms: [] }} />)
    expect(screen.getByText('no terms')).toBeInTheDocument()
    expect(screen.queryByTitle(/Confidence:/)).not.toBeInTheDocument()
  })
})
