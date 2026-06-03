import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OntologyGapsDisplay } from '../OntologyGapsDisplay'

describe('OntologyGapsDisplay', () => {
  it('renders nothing when gaps is empty', () => {
    const { container } = render(<OntologyGapsDisplay gaps={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each gap with its term and reason', () => {
    render(
      <OntologyGapsDisplay
        gaps={[
          { term: 'electric vehicle', reason: 'not in vocabulary' },
          { term: 'tunnel', reason: 'no matching property' },
        ]}
      />
    )

    expect(screen.getByText('“electric vehicle”')).toBeInTheDocument()
    expect(screen.getByText('— not in vocabulary')).toBeInTheDocument()
    expect(screen.getByText('“tunnel”')).toBeInTheDocument()
  })

  it('renders the Domain concept tag only when the flag is set', () => {
    render(
      <OntologyGapsDisplay
        gaps={[
          { term: 'first', reason: 'r1', isDomainConcept: true },
          { term: 'second', reason: 'r2' },
        ]}
      />
    )
    expect(screen.getAllByText('Domain concept')).toHaveLength(1)
  })

  it('renders suggestions as inline code chips', () => {
    render(
      <OntologyGapsDisplay
        gaps={[
          {
            term: 'highway',
            reason: 'unknown',
            suggestions: ['motorway', 'arterial'],
          },
        ]}
      />
    )
    expect(screen.getByText('motorway')).toBeInTheDocument()
    expect(screen.getByText('arterial')).toBeInTheDocument()
  })

  it('groups gaps into separate sections by kind', () => {
    render(
      <OntologyGapsDisplay
        gaps={[
          { term: 'purple elephant', reason: 'no match', kind: 'unmapped' },
          {
            term: 'with maps',
            reason: 'understood as hdmap/environment-model',
            kind: 'recognized',
          },
          { term: 'second ref', reason: 'dropped — one reference per query', kind: 'limitation' },
        ]}
      />
    )
    expect(screen.getByText('Not in ontology')).toBeInTheDocument()
    expect(screen.getByText('Understood, not filtered')).toBeInTheDocument()
    expect(screen.getByText('Query limitations')).toBeInTheDocument()
  })

  it('omits a section header when no gap has that kind', () => {
    render(<OntologyGapsDisplay gaps={[{ term: 'x', reason: 'r', kind: 'limitation' }]} />)
    expect(screen.queryByText('Not in ontology')).not.toBeInTheDocument()
    expect(screen.queryByText('Understood, not filtered')).not.toBeInTheDocument()
    expect(screen.getByText('Query limitations')).toBeInTheDocument()
  })

  it('renders the definition and scope note when present', () => {
    render(
      <OntologyGapsDisplay
        gaps={[
          {
            term: 'tunnel',
            reason: 'unknown',
            definition: 'A subterranean passage for vehicles',
            scopeNote: 'consider modeling as infrastructure',
          },
        ]}
      />
    )
    expect(screen.getByText('A subterranean passage for vehicles')).toBeInTheDocument()
    expect(screen.getByText(/consider modeling as infrastructure/i)).toBeInTheDocument()
  })
})
