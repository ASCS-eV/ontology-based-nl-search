import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SparqlPreview } from '../SparqlPreview'

const QUERY = 'SELECT ?s WHERE { ?s ?p ?o }'

// userEvent.setup() installs its own navigator.clipboard mock — we read
// from there rather than stubbing navigator ourselves.

describe('SparqlPreview', () => {
  it('renders the disclosure collapsed by default', () => {
    render(<SparqlPreview sparql={QUERY} />)
    expect(screen.getByRole('button', { name: /show generated sparql/i })).toBeInTheDocument()
    expect(screen.queryByText(QUERY)).not.toBeInTheDocument()
  })

  it('reveals the query body when the disclosure is opened', async () => {
    const user = userEvent.setup()
    render(<SparqlPreview sparql={QUERY} />)

    await user.click(screen.getByRole('button', { name: /show generated sparql/i }))

    expect(screen.getByText(QUERY)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy sparql query/i })).toBeInTheDocument()
  })

  /**
   * The user-observable contract: clicking Copy (a) writes the exact sparql
   * to the clipboard (we read from user-event's own clipboard mock), (b)
   * flips the button to "Copied", and (c) reverts to "Copy" after the
   * COPY_FEEDBACK_MS timeout. Real timers throughout — userEvent + fake
   * timers cannot coexist cleanly across an awaited interaction. waitFor's
   * default 1s timeout is short of the 2s feedback window, so we extend it.
   */
  it('copies the query and shows transient feedback', async () => {
    const user = userEvent.setup()
    render(<SparqlPreview sparql={QUERY} />)
    await user.click(screen.getByRole('button', { name: /show generated sparql/i }))

    const copyBtn = screen.getByRole('button', { name: /copy sparql query/i })
    await user.click(copyBtn)

    expect(await navigator.clipboard.readText()).toBe(QUERY)
    await waitFor(() => expect(copyBtn).toHaveTextContent(/copied/i))

    // Wait past the COPY_FEEDBACK_MS (2000ms) window.
    await waitFor(() => expect(copyBtn).toHaveTextContent(/^copy$/i), { timeout: 3500 })
  }, 8000)
})
