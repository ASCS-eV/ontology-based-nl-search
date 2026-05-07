import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { DomainSelector } from '../DomainSelector'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('DomainSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<DomainSelector selectedDomains={['hdmap']} onChange={jest.fn()} />)
    expect(screen.getByText('Loading domains…')).toBeInTheDocument()
  })

  it('renders domain buttons after fetch', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ domains: ['hdmap', 'scenario', 'ositrace'] }),
    })

    render(<DomainSelector selectedDomains={['hdmap']} onChange={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('HD Map')).toBeInTheDocument()
    })
    expect(screen.getByText('Scenario')).toBeInTheDocument()
    expect(screen.getByText('OSI Trace')).toBeInTheDocument()
  })

  it('highlights selected domains', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ domains: ['hdmap', 'scenario'] }),
    })

    render(<DomainSelector selectedDomains={['hdmap']} onChange={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('HD Map')).toBeInTheDocument()
    })

    const hdmapBtn = screen.getByText('HD Map')
    expect(hdmapBtn).toHaveClass('bg-blue-100')

    const scenarioBtn = screen.getByText('Scenario')
    expect(scenarioBtn).toHaveClass('bg-gray-100')
  })

  it('calls onChange when domain is toggled', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ domains: ['hdmap', 'scenario'] }),
    })

    const onChange = jest.fn()
    render(<DomainSelector selectedDomains={['hdmap']} onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByText('Scenario')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Scenario'))
    expect(onChange).toHaveBeenCalledWith(['hdmap', 'scenario'])
  })

  it('prevents deselecting the last domain', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ domains: ['hdmap', 'scenario'] }),
    })

    const onChange = jest.fn()
    render(<DomainSelector selectedDomains={['hdmap']} onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByText('HD Map')).toBeInTheDocument()
    })

    // Try to deselect the only selected domain — should keep it
    fireEvent.click(screen.getByText('HD Map'))
    expect(onChange).toHaveBeenCalledWith(['hdmap'])
  })

  it('renders nothing when domains list is empty', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ domains: [] }),
    })

    const { container } = render(
      <DomainSelector selectedDomains={['hdmap']} onChange={jest.fn()} />
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading domains…')).not.toBeInTheDocument()
    })

    // Should render nothing
    expect(container.querySelector('button')).toBeNull()
  })
})
