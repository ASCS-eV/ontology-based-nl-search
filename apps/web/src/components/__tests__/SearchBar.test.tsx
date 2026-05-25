import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SearchBar } from '../SearchBar'

describe('SearchBar', () => {
  it('fires onSearch with the trimmed query on submit', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)

    await user.type(
      screen.getByLabelText(/natural language search query/i),
      '   motorways in Germany   '
    )
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('motorways in Germany')
  })

  /**
   * Submit must be no-op on empty / whitespace-only input so the LLM never
   * sees a useless query and the operator never pays for it.
   */
  it('ignores submit when the input is empty or whitespace-only', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)

    const button = screen.getByRole('button', { name: /^search$/i })
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText(/natural language search query/i), '   ')
    // Disabled-state click resolves to no-op; assert no firing either way.
    expect(button).toBeDisabled()
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('disables the input and shows a spinner while loading', () => {
    render(<SearchBar onSearch={vi.fn()} loading />)
    expect(screen.getByLabelText(/natural language search query/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled()
  })

  it('disables input and button when disabled prop is true', () => {
    render(<SearchBar onSearch={vi.fn()} disabled />)
    expect(screen.getByLabelText(/natural language search query/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /^search$/i })).toBeDisabled()
  })

  it('opens the history dropdown on focus and fires onSearch with the picked entry', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} history={['previous query']} />)

    // No dropdown until the input is focused.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText(/natural language search query/i))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: /previous query/i }))
    expect(onSearch).toHaveBeenCalledWith('previous query')
  })
})
