import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { XoscPreview } from '../XoscPreview'

const XOSC = '<OpenSCENARIO><FileHeader/></OpenSCENARIO>'

describe('XoscPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the .xosc document read-only', () => {
    render(<XoscPreview xosc={XOSC} />)
    expect(screen.getByText(XOSC)).toBeInTheDocument()
  })

  it('copies the document and shows transient feedback', async () => {
    const user = userEvent.setup()
    render(<XoscPreview xosc={XOSC} />)

    const copyBtn = screen.getByRole('button', { name: /copy openscenario/i })
    await user.click(copyBtn)

    expect(await navigator.clipboard.readText()).toBe(XOSC)
    await waitFor(() => expect(copyBtn).toHaveTextContent(/copied/i))
  })

  it('downloads the document as a blob when Download is clicked', async () => {
    const user = userEvent.setup()
    const createUrl = vi.fn((_blob: Blob) => 'blob:mock')
    const revokeUrl = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL: createUrl, revokeObjectURL: revokeUrl })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<XoscPreview xosc={XOSC} filename="cut-in.xosc" />)
    await user.click(screen.getByRole('button', { name: /download/i }))

    expect(createUrl).toHaveBeenCalledOnce()
    const blob = createUrl.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(clickSpy).toHaveBeenCalledOnce()
  })
})
