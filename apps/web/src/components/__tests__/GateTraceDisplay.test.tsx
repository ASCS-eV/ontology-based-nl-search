import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { GateTrace } from '../../api-types'
import { renderWithDesignSystem as render } from '../../test-utils'
import { GateTraceDisplay } from '../GateTraceDisplay'

const PASSING: GateTrace[] = [
  { gate: 'semantic', ok: true, gapCount: 0 },
  { gate: 'structural', ok: true, gapCount: 0 },
  { gate: 'residual', ok: true, gapCount: 0, skipped: ['asam.net:xosc:1.0.0:some.rule'] },
]

describe('GateTraceDisplay', () => {
  it('renders a valid badge and one chip per gate', () => {
    render(<GateTraceDisplay trace={PASSING} valid={true} />)
    expect(screen.getByText(/valid/i)).toBeInTheDocument()
    expect(screen.getByText('Semantic')).toBeInTheDocument()
    expect(screen.getByText('Structural (XSD)')).toBeInTheDocument()
    expect(screen.getByText('Residual (geometry)')).toBeInTheDocument()
  })

  it('marks a gate as skipped when rules were not evaluated', () => {
    render(<GateTraceDisplay trace={PASSING} valid={true} />)
    expect(screen.getByText('skipped')).toBeInTheDocument()
  })

  it('shows an invalid badge and the failing gap count', () => {
    const failing: GateTrace[] = [{ gate: 'semantic', ok: false, gapCount: 2 }]
    render(<GateTraceDisplay trace={failing} valid={false} attempts={3} />)
    expect(screen.getByText(/invalid/i)).toBeInTheDocument()
    expect(screen.getByText('2 gap(s)')).toBeInTheDocument()
    expect(screen.getByText(/3 authoring attempts/i)).toBeInTheDocument()
  })
})
