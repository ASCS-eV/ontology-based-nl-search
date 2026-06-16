import { DesignSystemProvider, envitedDesignSystem } from '@ontology-search/design-system'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

function Wrapper({ children }: { children: ReactNode }) {
  return <DesignSystemProvider system={envitedDesignSystem}>{children}</DesignSystemProvider>
}

/**
 * Render a component under the default (ENVITED-X) design system, so primitives
 * that read the design-system context work in tests.
 */
export function renderWithDesignSystem(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: Wrapper, ...options })
}
