import type { SearchSlots } from '@ontology-search/slots/slots'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithDesignSystem as render } from '../../test-utils'
import { QueryRefinement } from '../QueryRefinement'

const emptySlots: SearchSlots = { domains: [], filters: {}, ranges: {} }

const baseSlots: SearchSlots = {
  domains: ['hdmap'],
  filters: { roadTypes: 'motorway', country: 'DE' },
  ranges: {},
}

describe('QueryRefinement', () => {
  it('returns null when the slot IR carries nothing to refine', () => {
    const { container } = render(<QueryRefinement slots={emptySlots} onRerun={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders every filter value as a chip', () => {
    render(<QueryRefinement slots={baseSlots} onRerun={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Edit motorway' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit DE' })).toBeInTheDocument()
  })

  /**
   * The Re-run button is the load-bearing action. It must be hidden until the
   * user changes something, and must pass the EDITED slots, not the originals.
   */
  it('hides the Re-run button until the slots change', () => {
    render(<QueryRefinement slots={baseSlots} onRerun={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /re-run/i })).not.toBeInTheDocument()
  })

  it('exposes Re-run after removing a value and passes the edited slots', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    render(<QueryRefinement slots={baseSlots} onRerun={onRerun} />)

    await user.click(screen.getByRole('button', { name: 'Remove DE filter' }))

    const rerun = screen.getByRole('button', { name: /re-run with modified filters/i })
    expect(rerun).toBeEnabled()
    await user.click(rerun)

    expect(onRerun).toHaveBeenCalledTimes(1)
    expect(onRerun).toHaveBeenCalledWith({
      domains: ['hdmap'],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    })
  })

  /**
   * The defect this component was rebuilt for. A multi-valued filter used to
   * round-trip through a single display string, so `['motorway','urban']` came
   * back as one value and the other was silently lost. One chip per value, and
   * every untouched value survives verbatim.
   */
  it('renders one chip per value and preserves the array when one is removed', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { roadTypes: ['motorway', 'urban', 'rural'] },
      ranges: {},
    }
    render(<QueryRefinement slots={slots} onRerun={onRerun} />)

    expect(screen.getByRole('button', { name: 'Edit motorway' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit urban' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit rural' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove urban filter' }))
    await user.click(screen.getByRole('button', { name: /re-run with modified filters/i }))

    expect(onRerun).toHaveBeenCalledWith({
      domains: ['hdmap'],
      filters: { roadTypes: ['motorway', 'rural'] },
      ranges: {},
    })
  })

  it('collapses a multi-value filter to a scalar when only one value remains', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    const slots: SearchSlots = {
      domains: [],
      filters: { roadTypes: ['motorway', 'urban'] },
      ranges: {},
    }
    render(<QueryRefinement slots={slots} onRerun={onRerun} />)

    await user.click(screen.getByRole('button', { name: 'Remove urban filter' }))
    await user.click(screen.getByRole('button', { name: /re-run with modified filters/i }))

    expect(onRerun).toHaveBeenCalledWith({
      domains: [],
      filters: { roadTypes: 'motorway' },
      ranges: {},
    })
  })

  it('drops the property entirely when its last value is removed', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    render(
      <QueryRefinement
        slots={{ domains: ['hdmap'], filters: { country: 'DE' }, ranges: {} }}
        onRerun={onRerun}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Remove DE filter' }))
    await user.click(screen.getByRole('button', { name: /re-run with modified filters/i }))

    expect(onRerun).toHaveBeenCalledWith({ domains: ['hdmap'], filters: {}, ranges: {} })
  })

  it('edits one value of an array without disturbing its siblings', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    render(
      <QueryRefinement
        slots={{ domains: [], filters: { roadTypes: ['motorway', 'urban'] }, ranges: {} }}
        onRerun={onRerun}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Edit urban' }))
    const input = screen.getByRole('textbox', { name: /edit value for roadTypes/i })
    await user.clear(input)
    await user.type(input, 'suburban{Enter}')
    await user.click(screen.getByRole('button', { name: /re-run with modified filters/i }))

    expect(onRerun).toHaveBeenCalledWith({
      domains: [],
      filters: { roadTypes: ['motorway', 'suburban'] },
      ranges: {},
    })
  })

  /**
   * Ranges previously survived the round-trip only if a regex could recover
   * them from prose like ">= 3". They are structured now, edited as numbers.
   */
  it('edits a numeric range through typed min/max inputs', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    render(
      <QueryRefinement
        slots={{ domains: [], filters: {}, ranges: { laneCount: { min: 3 } } }}
        onRerun={onRerun}
      />
    )

    await user.type(screen.getByRole('spinbutton', { name: /maximum laneCount/i }), '6')
    await user.click(screen.getByRole('button', { name: /re-run with modified filters/i }))

    expect(onRerun).toHaveBeenCalledWith({
      domains: [],
      filters: {},
      ranges: { laneCount: { min: 3, max: 6 } },
    })
  })

  it('carries cross-domain references through untouched', async () => {
    const user = userEvent.setup()
    const onRerun = vi.fn()
    const slots: SearchSlots = {
      domains: ['hdmap'],
      filters: { country: 'DE' },
      ranges: {},
      references: [{ domain: 'ositrace' }],
    }
    render(<QueryRefinement slots={slots} onRerun={onRerun} />)

    await user.click(screen.getByRole('button', { name: 'Remove DE filter' }))
    await user.click(screen.getByRole('button', { name: /re-run with modified filters/i }))

    expect(onRerun).toHaveBeenCalledWith({
      domains: ['hdmap'],
      filters: {},
      ranges: {},
      references: [{ domain: 'ositrace' }],
    })
  })

  /**
   * The loading flag must disable Re-run so a double-click cannot fire a
   * second refine while one is in flight.
   */
  it('disables Re-run while loading', async () => {
    const user = userEvent.setup()
    render(<QueryRefinement slots={baseSlots} onRerun={vi.fn()} loading />)
    await user.click(screen.getByRole('button', { name: 'Remove DE filter' }))

    const rerun = screen.getByRole('button', { name: /re-run with modified filters/i })
    expect(rerun).toBeDisabled()
    expect(rerun).toHaveTextContent(/running/i)
  })

  it('syncs to a new slots prop value', () => {
    const { rerender } = render(<QueryRefinement slots={baseSlots} onRerun={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Edit DE' })).toBeInTheDocument()

    rerender(
      <QueryRefinement
        slots={{ domains: ['ositrace'], filters: { roadTypes: 'urban' }, ranges: {} }}
        onRerun={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Edit DE' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit urban' })).toBeInTheDocument()
  })
})
