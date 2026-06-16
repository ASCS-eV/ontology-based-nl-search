import { createContext, createElement, type ReactNode, useContext } from 'react'

import type { DesignSystem } from './registry'

const DesignSystemContext = createContext<DesignSystem | null>(null)

export interface DesignSystemProviderProps {
  system: DesignSystem
  children: ReactNode
}

/**
 * Provides the active design system to the tree. Swap the `system` prop
 * (driven by config) to exchange the entire component library and branding.
 */
export function DesignSystemProvider({ system, children }: DesignSystemProviderProps): ReactNode {
  return createElement(DesignSystemContext.Provider, { value: system }, children)
}

/** Access the active design system. Throws if used outside the provider. */
export function useDesignSystem(): DesignSystem {
  const ctx = useContext(DesignSystemContext)
  if (!ctx) {
    throw new Error('useDesignSystem must be used within a <DesignSystemProvider>')
  }
  return ctx
}
