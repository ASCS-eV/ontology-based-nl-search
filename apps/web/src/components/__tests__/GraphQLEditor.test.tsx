import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { GraphQLEditor } from '../GraphQLEditor'

const SAMPLE_QUERY = `query {
  hdmap {
    country(values: ["Germany"])
    numberOfLanes(min: 3)
  }
}`

describe('GraphQLEditor', () => {
  it('renders the provided GraphQL value', () => {
    render(<GraphQLEditor value={SAMPLE_QUERY} />)

    // CodeMirror renders the text in its editor
    expect(screen.getByText(/GraphQL Query/i)).toBeInTheDocument()
  })

  it('shows the copy button and copies text on click', async () => {
    const user = userEvent.setup()
    render(<GraphQLEditor value={SAMPLE_QUERY} />)

    const copyBtn = screen.getByRole('button', { name: /copy graphql query/i })
    await user.click(copyBtn)

    expect(await navigator.clipboard.readText()).toBe(SAMPLE_QUERY)
    await waitFor(() => expect(copyBtn).toHaveTextContent(/copied/i))
  })

  it('does not show Reset button when content is unmodified', () => {
    render(<GraphQLEditor value={SAMPLE_QUERY} />)

    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
  })

  it('shows the header with "GraphQL Query" title', () => {
    render(<GraphQLEditor value={SAMPLE_QUERY} />)

    expect(screen.getByText('GraphQL Query')).toBeInTheDocument()
  })
})
