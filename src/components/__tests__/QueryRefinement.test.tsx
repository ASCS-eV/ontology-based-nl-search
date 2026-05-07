import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import type { MappedTerm } from '@/lib/llm/types'

import { QueryRefinement } from '../QueryRefinement'

const sampleTerms: MappedTerm[] = [
  { input: 'German', mapped: 'DE', confidence: 'high', property: 'country' },
  { input: 'Autobahn', mapped: 'motorway', confidence: 'high', property: 'roadTypes' },
  { input: '4 lanes', mapped: '4', confidence: 'medium', property: 'laneTypes' },
]

describe('QueryRefinement', () => {
  it('renders all mapped terms as chips', () => {
    render(<QueryRefinement mappedTerms={sampleTerms} onRerun={jest.fn()} />)
    expect(screen.getByText('DE')).toBeInTheDocument()
    expect(screen.getByText('motorway')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('shows property labels', () => {
    render(<QueryRefinement mappedTerms={sampleTerms} onRerun={jest.fn()} />)
    expect(screen.getByText('country:')).toBeInTheDocument()
    expect(screen.getByText('roadTypes:')).toBeInTheDocument()
  })

  it('does not render when no terms', () => {
    const { container } = render(<QueryRefinement mappedTerms={[]} onRerun={jest.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('removes a term and shows re-run button', () => {
    render(<QueryRefinement mappedTerms={sampleTerms} onRerun={jest.fn()} />)
    const removeButtons = screen.getAllByLabelText(/Remove/)
    fireEvent.click(removeButtons[0]!)
    expect(screen.queryByText('DE')).not.toBeInTheDocument()
    expect(screen.getByText('Re-run')).toBeInTheDocument()
  })

  it('calls onRerun with modified terms when re-run clicked', () => {
    const onRerun = jest.fn()
    render(<QueryRefinement mappedTerms={sampleTerms} onRerun={onRerun} />)
    const removeButtons = screen.getAllByLabelText(/Remove/)
    fireEvent.click(removeButtons[0]!)
    fireEvent.click(screen.getByText('Re-run'))
    expect(onRerun).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ mapped: 'motorway' }),
        expect.objectContaining({ mapped: '4' }),
      ])
    )
    expect(onRerun).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ mapped: 'DE' })])
    )
  })

  it('allows editing a term value', () => {
    render(<QueryRefinement mappedTerms={sampleTerms} onRerun={jest.fn()} />)
    fireEvent.click(screen.getByText('DE'))
    const input = screen.getByLabelText(/Edit value/)
    fireEvent.change(input, { target: { value: 'US' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('US')).toBeInTheDocument()
    expect(screen.getByText('Re-run')).toBeInTheDocument()
  })

  it('disables re-run button when loading', () => {
    render(<QueryRefinement mappedTerms={sampleTerms} onRerun={jest.fn()} loading={true} />)
    // First remove a term to trigger the button to appear
    const removeButtons = screen.getAllByLabelText(/Remove/)
    fireEvent.click(removeButtons[0]!)
    const rerunButton = screen.getByText('Running…')
    expect(rerunButton).toBeDisabled()
  })
})
