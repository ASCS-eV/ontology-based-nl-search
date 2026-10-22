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

  /**
   * Regression: a term mapped to a class IRI rendered the whole IRI
   * (`https://…/ontologies/MotorwayManaged`) instead of its local name.
   */
  it('shows the local name of an IRI-valued mapping, with the full IRI as tooltip', () => {
    const iri = 'https://example.org/ontologies/MotorwayManaged'
    render(
      <InterpretationDisplay
        interpretation={{
          summary: 's',
          mappedTerms: [
            {
              input: 'access-controlled motorway',
              mapped: iri,
              confidence: 'high',
              property: 'DrivableAreaType',
            },
          ],
        }}
      />
    )
    expect(screen.getByText('MotorwayManaged')).toHaveAttribute('title', iri)
    expect(screen.queryByText(iri)).not.toBeInTheDocument()
  })

  it('shows the scope the user selected next to the interpretation', () => {
    render(
      <InterpretationDisplay interpretation={baseInterpretation} scope={['hdmap', 'openlabel']} />
    )
    expect(screen.getByText('Interpreted within your selection:')).toBeInTheDocument()
    expect(screen.getByText('openlabel')).toBeInTheDocument()
  })

  it('shows no scope when the model chose the domains', () => {
    render(<InterpretationDisplay interpretation={baseInterpretation} />)
    expect(screen.queryByText('Interpreted within your selection:')).not.toBeInTheDocument()
  })
})
