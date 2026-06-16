import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button, Pill } from '../components/primitives'
import { DesignSystemProvider, useDesignSystem } from '../provider'
import { envitedDesignSystem } from '../themes/envited'

function renderWithEnvited(ui: React.ReactNode) {
  return render(<DesignSystemProvider system={envitedDesignSystem}>{ui}</DesignSystemProvider>)
}

describe('design-system provider + primitives', () => {
  it('renders the active system implementation for a primitive', () => {
    renderWithEnvited(<Button onClick={() => {}}>Run</Button>)
    const btn = screen.getByRole('button', { name: 'Run' })
    expect(btn).toBeInTheDocument()
    // ENVITED-X primary button uses the blue accent
    expect(btn.className).toContain('bg-blue-600')
  })

  it('passes tone through to the implementation', () => {
    renderWithEnvited(<Pill tone="success">OK</Pill>)
    expect(screen.getByText('OK').getAttribute('style')).toContain('--ds-tone-success-fg')
  })

  it('throws a helpful error when a primitive is used without a provider', () => {
    function Bare() {
      useDesignSystem()
      return null
    }
    expect(() => render(<Bare />)).toThrow(/within a <DesignSystemProvider>/)
  })
})
