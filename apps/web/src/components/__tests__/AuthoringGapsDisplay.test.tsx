import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { SceneGap } from '../../api-types'
import { AuthoringGapsDisplay } from '../AuthoringGapsDisplay'

const GAPS: SceneGap[] = [
  {
    term: 'entityRef Phantom',
    reason: 'Entity not declared among Entities but referred in an entityRef attribute',
    ruleUid: 'asam.net:xosc:1.2.0:reference_control.resolvable_entity_references',
    gate: 'semantic',
    focusNode: 'A2',
  },
  {
    term: 'schema',
    reason: 'Value not allowed',
    ruleUid: 'asam.net:xosc:1.0.0:xml.valid_schema',
    gate: 'structural',
    location: { line: 12, col: 8 },
  },
]

describe('AuthoringGapsDisplay', () => {
  it('renders nothing when there are no gaps', () => {
    const { container } = render(<AuthoringGapsDisplay gaps={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('groups gaps by gate and shows the ASAM rule UID for each', () => {
    render(<AuthoringGapsDisplay gaps={GAPS} />)

    expect(screen.getByText('Semantic gate')).toBeInTheDocument()
    expect(screen.getByText('Structural gate (XSD)')).toBeInTheDocument()
    expect(
      screen.getByText('asam.net:xosc:1.2.0:reference_control.resolvable_entity_references')
    ).toBeInTheDocument()
    expect(screen.getByText('asam.net:xosc:1.0.0:xml.valid_schema')).toBeInTheDocument()
  })

  it('shows the focus node and source location when present', () => {
    render(<AuthoringGapsDisplay gaps={GAPS} />)
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getByText(/line 12, col 8/i)).toBeInTheDocument()
  })
})
