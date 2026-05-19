import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { MappedTerm } from '../../api-types'
import { QueryRefinement } from '../QueryRefinement'

const baseTerms: MappedTerm[] = [
  { input: 'motorway', mapped: 'motorway', confidence: 'high', property: 'roadTypes' },
  { input: 'Germany', mapped: 'DE', confidence: 'medium', property: 'country' },
]

const baseDomains = ['hdmap']

describe('QueryRefinement', () => {
  it('returns null when there are no terms or domains to refine', () => {
    const { container } = render(
      <QueryRefinement mappedTerms={[]} domains={[]} onRerun={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders every mapped term as a chip', () => {
    render(<QueryRefinement mappedTerms={baseTerms} domains={baseDomains} onRerun={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Edit motorway' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit DE' })).toBeInTheDocument()
  })

  /**
   * The Re-run button is the load-bearing action. It must:
   *  - Be hidden when the user has not modified anything (no false work).
   *  - Appear once a term is removed or edited.
   *  - Pass the modified term set to onRerun, NOT the original.
   */
  it('hides the Re-run button until a term changes', () => {
    render(<QueryRefinement mappedTerms={baseTerms} domains={baseDomains} onRerun={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /re-run/i })).not.toBeInTheDocument()
  })

  it('exposes Re-run after removing a term and passes the trimmed list to onRerun', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    render(<QueryRefinement mappedTerms={baseTerms} domains={baseDomains} onRerun={onRerun} />)

    await user.click(screen.getByRole('button', { name: 'Remove DE filter' }))

    const rerun = screen.getByRole('button', { name: /re-run with modified filters/i })
    expect(rerun).toBeEnabled()
    await user.click(rerun)

    expect(onRerun).toHaveBeenCalledTimes(1)
    expect(onRerun).toHaveBeenCalledWith([baseTerms[0]], baseDomains)
  })

  /**
   * The loading flag must disable Re-run so a double-click cannot fire a
   * second refine while one is in flight.
   */
  it('disables Re-run while loading', async () => {
    const user = userEvent.setup()
    render(
      <QueryRefinement mappedTerms={baseTerms} domains={baseDomains} onRerun={vi.fn()} loading />
    )
    await user.click(screen.getByRole('button', { name: 'Remove DE filter' }))

    const rerun = screen.getByRole('button', { name: /re-run with modified filters/i })
    expect(rerun).toBeDisabled()
    expect(rerun).toHaveTextContent(/running/i)
  })

  /**
   * Regression for the PR #26 change: a new `mappedTerms` prop must reset
   * the internal edit state — otherwise stale chips would survive a new
   * search. The earlier implementation used JSON.stringify-based comparison;
   * the structural one must still recognise an in-place new array.
   */
  it('syncs to a new mappedTerms prop value', () => {
    const { rerender } = render(
      <QueryRefinement mappedTerms={baseTerms} domains={baseDomains} onRerun={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Edit DE' })).toBeInTheDocument()

    rerender(
      <QueryRefinement
        mappedTerms={[
          { input: 'urban', mapped: 'urban', confidence: 'high', property: 'roadTypes' },
        ]}
        domains={['ositrace']}
        onRerun={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Edit DE' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit urban' })).toBeInTheDocument()
  })
})
