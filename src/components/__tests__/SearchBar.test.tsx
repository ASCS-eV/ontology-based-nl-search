import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'

import { SearchBar } from '../SearchBar'

describe('SearchBar', () => {
  it('renders the search input and button', () => {
    render(<SearchBar onSearch={jest.fn()} />)
    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(screen.getByLabelText('Natural language search query')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('calls onSearch with trimmed input on submit', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)

    const input = screen.getByLabelText('Natural language search query')
    fireEvent.change(input, { target: { value: '  German highways  ' } })
    fireEvent.submit(screen.getByRole('search'))

    expect(onSearch).toHaveBeenCalledWith('German highways')
  })

  it('does not submit empty input', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    fireEvent.submit(screen.getByRole('search'))
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('disables input and button while loading', () => {
    render(<SearchBar onSearch={jest.fn()} loading={true} />)
    expect(screen.getByLabelText('Natural language search query')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Searching...' })).toBeDisabled()
  })

  it('shows history dropdown on focus when input is empty', () => {
    render(<SearchBar onSearch={jest.fn()} history={['query 1', 'query 2']} />)
    const input = screen.getByLabelText('Natural language search query')
    fireEvent.focus(input)
    expect(screen.getByRole('listbox', { name: 'Recent searches' })).toBeInTheDocument()
    expect(screen.getByText('query 1')).toBeInTheDocument()
  })

  it('selects history item and triggers search', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} history={['previous query']} />)
    const input = screen.getByLabelText('Natural language search query')
    fireEvent.focus(input)
    fireEvent.click(screen.getByText('previous query'))
    expect(onSearch).toHaveBeenCalledWith('previous query')
  })
})
