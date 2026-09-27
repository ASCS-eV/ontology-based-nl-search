import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SearchBar } from '../SearchBar'

describe('SearchBar', () => {
  /**
   * Regression: the field was a single-line <input> with the submit button
   * positioned over its right edge, so a long query scrolled out of sight and
   * its end sat under the button. It is now a multi-line field that wraps and
   * grows; the layout half (wrapping, growing, no overlap) needs a real
   * browser and is pinned in apps/e2e/tests/search.spec.ts.
   */
  it('holds a multi-line query: Shift+Enter adds a line break instead of submitting', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    const field = screen.getByLabelText(/natural language search query/i)

    await user.type(field, 'HD maps in Germany{Shift>}{Enter}{/Shift}with over 10 intersections')

    expect(field).toHaveValue('HD maps in Germany\nwith over 10 intersections')
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('submits on Enter, like the single-line field it replaces, without adding a line break', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    const field = screen.getByLabelText(/natural language search query/i)

    await user.type(field, 'motorways in Germany{Enter}')

    expect(onSearch).toHaveBeenCalledWith('motorways in Germany')
    expect(field).toHaveValue('motorways in Germany')
  })

  it('does not submit on Enter while an IME composition is open', () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    const field = screen.getByLabelText(/natural language search query/i)

    fireEvent.change(field, { target: { value: 'とうきょう' } })
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true })

    expect(onSearch).not.toHaveBeenCalled()
  })

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

  /**
   * The bar is reused outside search (authoring describes scenarios, not
   * searches), so the dropdown names what the entries actually are.
   */
  it('labels the history dropdown with historyLabel', async () => {
    const user = userEvent.setup()
    render(
      <SearchBar
        onSearch={vi.fn()}
        history={['a cut-in on a three-lane highway']}
        historyLabel="Recent descriptions"
        inputAriaLabel="Scenario description"
      />
    )

    await user.click(screen.getByLabelText(/scenario description/i))
    expect(screen.getByRole('listbox', { name: /recent descriptions/i })).toBeInTheDocument()
    expect(screen.getByText(/recent descriptions/i)).toBeInTheDocument()
  })
})
