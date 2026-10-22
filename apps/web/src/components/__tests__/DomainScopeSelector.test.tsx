import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DomainScopeSelector } from '../DomainScopeSelector'

const AVAILABLE = ['hdmap', 'openlabel', 'scenario']

describe('DomainScopeSelector', () => {
  it('says the search covers every domain while nothing is chosen', () => {
    render(<DomainScopeSelector available={AVAILABLE} selected={[]} onChange={vi.fn()} />)
    expect(screen.getByText('all domains')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('adds a chosen domain, keeping the order the ontology lists them in', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DomainScopeSelector available={AVAILABLE} selected={['scenario']} onChange={onChange} />
    )

    await user.click(screen.getByRole('button', { name: 'Choose domains' }))
    await user.click(screen.getByRole('checkbox', { name: 'hdmap' }))

    expect(onChange).toHaveBeenCalledWith(['hdmap', 'scenario'])
  })

  it('removes a domain from its chip and clears the whole scope', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DomainScopeSelector
        available={AVAILABLE}
        selected={['hdmap', 'openlabel']}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Remove hdmap from the search scope' }))
    expect(onChange).toHaveBeenLastCalledWith(['openlabel'])

    await user.click(screen.getByRole('button', { name: 'Search all' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })
})
